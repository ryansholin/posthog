import { useActions, useValues } from 'kea'

import { IconExternal } from '@posthog/icons'
import { Badge, Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '@posthog/quill'

import { LinkPrimitive } from 'lib/lemon-ui/Link'
import { urls } from 'scenes/urls'

import { ReportChart } from 'products/signals/frontend/inbox/components/detail/ReportChart'
import { ReportChartsContext } from 'products/signals/frontend/inbox/components/detail/reportChartsContext'
import { ReportSummaryBody } from 'products/signals/frontend/inbox/components/detail/ReportSummaryBody'

import { TodayIcon } from './TodayIcon'
import { TodayReportEvidence } from './TodayReportEvidence'
import { todayReportLogic } from './todayReportLogic'
import { TodayReportPrompts } from './TodayReportPrompts'
import { TodaySampleBanner } from './TodaySampleBanner'
import { isSampleReportId } from './todaySampleReports'
import { reportIcon, reportMeta, reportSource, reportTitle } from './todaySignalReports'

export function TodayReportPage({ reportId }: { reportId: string }): JSX.Element {
    const logic = todayReportLogic({ reportId })
    const { currentReport, reportFailed, fullReportLoading, chartPlacements, chartsById, trailingCharts, reportUrl } =
        useValues(logic)
    const { loadFullReport } = useActions(logic)
    const sampleDisabledReason = isSampleReportId(reportId) ? 'This is a sample report.' : undefined

    if (!currentReport) {
        return reportFailed ? (
            <div className="TodayReport Today__page">
                <TodaySampleBanner />
                <h1 className="TodayReport__heading">Couldn’t open this report.</h1>
                <div className="TodayReport__body">
                    <p>It may have been deleted, or the request failed. Try again, or go back to today’s briefing.</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-6" data-quill>
                    <Button
                        variant="primary"
                        onClick={() => loadFullReport()}
                        loading={fullReportLoading}
                        data-attr="today-report-retry"
                    >
                        Try again
                    </Button>
                    <Button
                        variant="outline"
                        nativeButton={false}
                        render={<LinkPrimitive to={urls.projectHomepage()} />}
                        data-attr="today-report-missing-home"
                    >
                        Back to Home
                    </Button>
                </div>
            </div>
        ) : (
            <div className="TodayReport Today__page flex flex-col gap-4" data-quill>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-24" />
            </div>
        )
    }

    return (
        <div
            className="TodayReport Today__page"
            // eslint-disable-next-line react/forbid-dom-props
            style={{ '--report-color': reportSource(currentReport).color } as React.CSSProperties}
        >
            <TodaySampleBanner />
            <article>
                <div className="TodayReport__kicker">
                    <span className="TodayTile">
                        <TodayIcon icon={reportIcon(currentReport)} />
                    </span>
                    <span>{reportMeta(currentReport)}</span>
                    {currentReport.priority && (
                        <span data-quill>
                            <Badge>{currentReport.priority}</Badge>
                        </span>
                    )}
                </div>
                <h1 className="TodayReport__heading">{reportTitle(currentReport)}</h1>
                <div className="flex flex-wrap gap-2 mt-4" data-quill>
                    {currentReport.implementation_pr_url && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        variant="primary"
                                        disabled={!!sampleDisabledReason}
                                        nativeButton={!!sampleDisabledReason}
                                        render={
                                            sampleDisabledReason ? undefined : (
                                                <LinkPrimitive
                                                    to={currentReport.implementation_pr_url}
                                                    target="_blank"
                                                />
                                            )
                                        }
                                        data-attr="today-report-pull-request"
                                    />
                                }
                            >
                                Review the pull request
                                <IconExternal />
                            </TooltipTrigger>
                            {sampleDisabledReason && <TooltipContent>{sampleDisabledReason}</TooltipContent>}
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    disabled={!!sampleDisabledReason}
                                    nativeButton={!!sampleDisabledReason}
                                    render={
                                        sampleDisabledReason ? undefined : (
                                            <LinkPrimitive to={urls.inboxReport('reports', currentReport.id)} />
                                        )
                                    }
                                    data-attr="today-report-open-inbox"
                                />
                            }
                        >
                            Open in Inbox
                        </TooltipTrigger>
                        {sampleDisabledReason && <TooltipContent>{sampleDisabledReason}</TooltipContent>}
                    </Tooltip>
                </div>
                <ReportChartsContext.Provider value={chartsById}>
                    <div className="TodayReport__body">
                        {currentReport.summary ? (
                            <ReportSummaryBody summary={currentReport.summary} chartPlacements={chartPlacements} />
                        ) : (
                            <p>No summary yet. An agent is still investigating.</p>
                        )}
                        {trailingCharts.map((chart) => (
                            <ReportChart key={chart.chart_id} chartId={chart.chart_id} />
                        ))}
                    </div>
                </ReportChartsContext.Provider>
            </article>
            <TodayReportEvidence reportId={currentReport.id} />
            <TodayReportPrompts report={currentReport} reportUrl={reportUrl} />
        </div>
    )
}
