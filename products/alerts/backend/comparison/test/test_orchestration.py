from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from unittest import TestCase
from unittest.mock import patch

from products.alerts.backend.comparison.contracts import (
    CheckRef,
    IntentionalDivergence,
    PlatformCheck,
    SourceCoverage,
    SourceVerdict,
)
from products.alerts.backend.comparison.orchestration import run_comparison
from products.alerts.backend.comparison.platform_history import ComparisonWindowTooLarge
from products.alerts.backend.facade.contracts import SourceKind
from products.alerts.backend.facade.lifecycle import LOGS_ALERT_POLICY

SINCE = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
UNTIL = SINCE + timedelta(hours=1)
READER = "products.alerts.backend.comparison.orchestration.read_platform_checks"


def _check(state: str) -> PlatformCheck:
    return PlatformCheck(
        team_id=1,
        configuration_id=uuid4(),
        legacy_configuration_id=uuid4(),
        alert_id=uuid4(),
        grouping_key="",
        evaluation_key="window:2026-10-01T12:59:00+00:00",
        kind="check",
        previous_state="not_firing",
        state=state,
        muted_notification="none",
        error_message="",
        occurred_at=SINCE,
    )


class _Correspondence:
    """A source that answers whatever the test tells it to, including by saying nothing."""

    source = SourceKind.LOGS
    production_policy = LOGS_ALERT_POLICY
    platform_policy = LOGS_ALERT_POLICY
    intentional_divergences: tuple[IntentionalDivergence, ...] = ()

    def __init__(self, states: dict[CheckRef, str] | None = None) -> None:
        self._states = states or {}

    def verdicts_for(self, checks: Sequence[PlatformCheck]) -> Mapping[CheckRef, SourceVerdict]:
        return {
            check.ref: SourceVerdict(coverage=SourceCoverage.EVALUATED, state=self._states[check.ref])
            for check in checks
            if check.ref in self._states
        }


class TestRunComparison(TestCase):
    def test_a_check_the_source_left_unanswered_is_not_counted_as_agreement(self) -> None:
        # The contract obliges a correspondence to answer every ref. A source that under-answers
        # would otherwise lift the agreement rate by shrinking its own denominator.
        checks = [_check("firing"), _check("firing")]
        answered = {checks[0].ref: "firing"}

        with patch(READER, autospec=True, return_value=checks):
            run = run_comparison(correspondence=_Correspondence(answered), team_ids=[1], since=SINCE, until=UNTIL)

        assert run.checks == 2
        assert run.by_coverage[SourceCoverage.UNKNOWN] == 1
        assert run.agreement_rate == 1.0

    def test_a_team_whose_window_is_too_large_does_not_cost_the_sweep(self) -> None:
        checks = [_check("firing")]

        def read(*, team_id: int, **_: object) -> Sequence[PlatformCheck]:
            if team_id == 1:
                raise ComparisonWindowTooLarge("narrow it")
            return checks

        with patch(READER, autospec=True, side_effect=read):
            run = run_comparison(
                correspondence=_Correspondence({checks[0].ref: "firing"}),
                team_ids=[1, 2],
                since=SINCE,
                until=UNTIL,
            )

        assert set(run.teams_unread) == {1}
        assert run.teams_read == 1
        assert run.checks == 1

    def test_the_rate_measures_agreement_rather_than_how_much_the_source_could_answer(self) -> None:
        # Counting UNCOMPARABLE against agreement would make the headline number track backfill
        # completeness instead, which is the trap this run reports `by_coverage` separately to avoid.
        checks = [_check("firing"), _check("firing"), _check("not_firing")]
        answered = {checks[0].ref: "firing", checks[2].ref: "firing"}

        with patch(READER, autospec=True, return_value=checks):
            run = run_comparison(correspondence=_Correspondence(answered), team_ids=[1], since=SINCE, until=UNTIL)

        assert run.agreement_rate == 0.5
        assert run.by_coverage[SourceCoverage.UNKNOWN] == 1
        assert len(run.divergences) == 1
