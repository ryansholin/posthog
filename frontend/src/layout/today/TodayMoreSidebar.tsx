import { useActions } from 'kea'

import { IconChevronRight } from '@posthog/icons'
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemSeparator,
    ItemTitle,
} from '@posthog/quill'

import { TODAY_MORE_ITEMS } from './todayRailItems'
import { todayShellLogic } from './todayShellLogic'

/** The More pane on the phone tab bar. It lists the panes that do not fit in the bar. */
export function TodayMoreSidebar(): JSX.Element {
    const { pickPane } = useActions(todayShellLogic)

    return (
        <div className="TodayPane" data-quill>
            <ItemGroup>
                {TODAY_MORE_ITEMS.map(({ pane, label, icon, description }, index) => (
                    <div key={pane}>
                        {index > 0 && <ItemSeparator />}
                        <Item
                            render={<button type="button" className="w-full text-left hover:bg-fill-hover" />}
                            onClick={() => pickPane(pane)}
                            data-attr={`today-more-${pane}`}
                        >
                            <ItemMedia variant="icon">{icon}</ItemMedia>
                            <ItemContent>
                                <ItemTitle>{label}</ItemTitle>
                                <ItemDescription>{description}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <IconChevronRight className="text-muted-foreground" />
                            </ItemActions>
                        </Item>
                    </div>
                ))}
            </ItemGroup>
        </div>
    )
}
