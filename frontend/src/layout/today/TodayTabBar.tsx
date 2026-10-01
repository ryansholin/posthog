import { useActions, useValues } from 'kea'

import { IconSearch } from '@posthog/icons'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@posthog/quill'

import { commandLogic } from 'lib/components/Command/commandLogic'

import { TODAY_TAB_BAR_ITEMS } from './todayRailItems'
import { TODAY_MORE_PANES, todayShellLogic } from './todayShellLogic'

/** The rail on phone-width windows: the panes in a bar across the bottom, with search beside them. */
export function TodayTabBar(): JSX.Element {
    const { activePane } = useValues(todayShellLogic)
    const { pickPane } = useActions(todayShellLogic)
    const { toggleCommand } = useActions(commandLogic)

    return (
        <div className="TodayTabBar" data-quill>
            <nav aria-label="Main" className="TodayTabBar__tabs rounded-full">
                {TODAY_TAB_BAR_ITEMS.map(({ pane, label, icon }) => {
                    const active = activePane === pane || (pane === 'more' && TODAY_MORE_PANES.includes(activePane))
                    return (
                        <button
                            key={pane}
                            type="button"
                            className="TodayTabBar__tab rounded-full"
                            data-active={active}
                            aria-current={active ? 'page' : undefined}
                            data-attr={`today-rail-${pane}`}
                            onClick={() => pickPane(pane)}
                        >
                            <span className="TodayTabBar__icon" aria-hidden>
                                {icon}
                            </span>
                            <span>{label}</span>
                        </button>
                    )
                })}
            </nav>
            <Tooltip>
                <TooltipTrigger
                    delay={0}
                    render={
                        <Button
                            size="icon-lg"
                            className="TodayTabBar__search rounded-full"
                            aria-label="Search"
                            data-attr="today-rail-search"
                            onClick={() => toggleCommand('nav-search-button')}
                        />
                    }
                >
                    <IconSearch />
                </TooltipTrigger>
                <TooltipContent>Search</TooltipContent>
            </Tooltip>
        </div>
    )
}
