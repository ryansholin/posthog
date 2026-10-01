"""What drives a comparison: choose a window, read both sides, classify every pair.

## Running one

Nothing schedules this. Until something does, a run is a Django shell away, on a pod or locally.
Both reads are read-only, so this cannot change what either stack does.

    from datetime import UTC, datetime, timedelta

    from products.alerts.backend.comparison.orchestration import run_comparison
    from products.alerts.backend.comparison.platform_history import teams_with_configurations
    from products.alerts.backend.facade.contracts import SourceKind
    from products.logs.backend.alert_comparison import LogsCorrespondence

    until = datetime.now(UTC)
    run = run_comparison(
        correspondence=LogsCorrespondence(),
        team_ids=teams_with_configurations(SourceKind.LOGS),
        since=until - timedelta(hours=24),
        until=until,
    )
    print(run.checks, run.agreement_rate, run.by_agreement, run.by_coverage, run.by_divergence)

Read the three breakdowns together or the headline misleads. `by_coverage` says how much of the
window the source could answer for: a large `unknown` share means the backfill is incomplete, not
that the stacks disagree. `by_divergence` splits the disagreements, and `real` is the only class
worth chasing, with the caveat below. `run.divergences` holds up to `MAX_SAMPLED_DIVERGENCES`
of them, each naming its alert and both states, which is where to start reading.

Widen the window past 90 days and the platform's rows have expired; `ComparisonWindowTooLarge`
means narrow it rather than retry.

## How a pair is chosen

The join is one-directional, so there is no set-matching problem to solve. `read_platform_checks`
returns platform checks, and each one asks the source what state it held at that check's
`occurred_at`. The source side is not a set of checks at all: it is a state reconstruction that
answers for any instant. Five platform checks against three source checks in one window gives five
comparisons, not an alignment problem.

Two joins, both exact. `legacy_configuration_id` names the alert. `occurred_at` names the moment.

## The decision this leaves open

Neither join handles phase skew between the two cadences. The only defense is `SourceCoverage`
`BEHIND`, which asks whether the source had *seen* the data, by testing its own last check against
the window end in the evaluation key. It does not ask whether the source has had a check *since*
that data, so two stacks a few minutes out of phase produce a false `REAL`:

- The platform checks at 12:00 over a window ending 11:59, sees a breach, goes firing.
- Production logs last checked at 11:59, so the `BEHIND` test passes and coverage reads `EVALUATED`.
- Its own next check is 12:04, so at 12:00 it is still not firing.
- The states differ under `EVALUATED` coverage, which classifies as `REAL`.

The N-of-M window is a second route to the same false positive, independent of scheduling: each
stack builds its recent-breach history from its own rows, so two stacks reading the same data can
sit at different points in their own counts.

No tolerance is applied here, on purpose. Narrowing the comparison to instants where both stacks
have settled would discard comparisons to buy precision, and the rate being bought is unknown. A
run reports its classes separately so the first one measures how much `REAL` is really phase skew,
and the tolerance is chosen against that number rather than ahead of it.

So do not read the first run's `real` count as the number of genuine disagreements. Read it as an
upper bound, and spend the first run working out what share of it is two cadences out of phase.

## What a run cannot see

Every comparison starts from a platform row, so a check the source made and the platform never did
is invisible. A run measures what the platform decided and whether the source agreed, not whether
the two made the same checks.

## Why the correspondence is a parameter

`products.alerts` may not import `products.logs`, so a registry of correspondences cannot live
here. The caller supplies one, which also keeps a run from classifying one source's verdicts under
another source's declarations.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import field
from datetime import datetime

import structlog

from posthog.dataclasses import frozen

from products.alerts.backend.comparison.contracts import CheckRef, SourceCorrespondence, SourceCoverage, SourceVerdict
from products.alerts.backend.comparison.divergence import Agreement, Comparison, compare
from products.alerts.backend.comparison.platform_history import ComparisonWindowTooLarge, read_platform_checks
from products.alerts.backend.facade.contracts import SourceKind

logger = structlog.get_logger(__name__)

# A run reports a rate and a sample, not every row. Past this the sample stops growing and the
# counts carry on, because the counts are what the rate is built from.
MAX_SAMPLED_DIVERGENCES = 200


@frozen
class ComparisonRun:
    """What one sweep found.

    The three breakdowns answer different questions and a reader needs all of them. `by_divergence`
    is the output the exercise exists for. `by_coverage` says how much of the window the source
    could answer for at all, which measures how complete the backfill is as much as it measures
    agreement. `teams_unread` says where the sweep saw nothing, which is neither.
    """

    source: SourceKind
    since: datetime
    until: datetime
    teams_read: int
    checks: int
    by_agreement: dict[str, int] = field(default_factory=dict)
    by_divergence: dict[str, int] = field(default_factory=dict)
    by_coverage: dict[str, int] = field(default_factory=dict)
    teams_unread: dict[int, str] = field(default_factory=dict)
    divergences: tuple[Comparison, ...] = ()

    @property
    def agreement_rate(self) -> float | None:
        """Agreed over what could be compared at all.

        `UNCOMPARABLE` is excluded rather than counted against agreement, because a source that
        cannot answer has not disagreed. None when nothing was comparable, which is a different
        answer from zero.
        """
        comparable = self.by_agreement.get(Agreement.AGREED, 0) + self.by_agreement.get(Agreement.DIVERGED, 0)
        if not comparable:
            return None
        return self.by_agreement.get(Agreement.AGREED, 0) / comparable


def run_comparison(
    *,
    correspondence: SourceCorrespondence,
    team_ids: Sequence[int],
    since: datetime,
    until: datetime,
) -> ComparisonRun:
    """Every platform check in the window, set against what the source held at the same moment.

    One team at a time, because the platform read is per team. A team the platform cannot be read
    for is recorded and the sweep continues, so one oversized window does not cost the rest.
    """
    # A repeated team would otherwise count its checks twice, and leave `teams_read` claiming a
    # team the sweep only failed to read.
    teams = list(dict.fromkeys(team_ids))
    agreements: Counter[str] = Counter()
    divergence_classes: Counter[str] = Counter()
    coverages: Counter[str] = Counter()
    unread: dict[int, str] = {}
    sampled: list[Comparison] = []
    checks = 0

    for team_id in teams:
        try:
            platform_checks = read_platform_checks(
                team_id=team_id, source=correspondence.source, since=since, until=until
            )
        except ComparisonWindowTooLarge as error:
            unread[team_id] = str(error)
            logger.warning(
                "Comparison skipped a team whose window is too large",
                team_id=team_id,
                source=correspondence.source.value,
            )
            continue
        if not platform_checks:
            continue

        verdicts = correspondence.verdicts_for(platform_checks)
        for check in platform_checks:
            comparison = compare(check, _verdict_for(verdicts, check.ref), correspondence=correspondence)
            checks += 1
            agreements[comparison.agreement.value] += 1
            coverages[comparison.coverage.value] += 1
            if comparison.divergence is not None:
                divergence_classes[comparison.divergence.value] += 1
                if len(sampled) < MAX_SAMPLED_DIVERGENCES:
                    sampled.append(comparison)

    return ComparisonRun(
        source=correspondence.source,
        since=since,
        until=until,
        teams_read=len(teams) - len(unread),
        checks=checks,
        by_agreement=dict(agreements),
        by_divergence=dict(divergence_classes),
        by_coverage=dict(coverages),
        teams_unread=unread,
        divergences=tuple(sampled),
    )


def _verdict_for(verdicts: Mapping[CheckRef, SourceVerdict], ref: CheckRef) -> SourceVerdict:
    """The source's answer for one check, or an unanswered one.

    The contract obliges a correspondence to answer every ref it was given. Nothing enforced that
    until there was a caller holding both sides, and a missing ref must not read as agreement.
    """
    return verdicts.get(ref) or SourceVerdict(
        coverage=SourceCoverage.UNKNOWN, state=None, detail="the source returned no verdict for this check"
    )
