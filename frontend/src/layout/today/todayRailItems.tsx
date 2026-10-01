import { IconBook, IconChat, IconGridMasonry, IconHome, IconWrench } from '@posthog/icons'

import { TodayRailPane } from './todayShellLogic'

export const TODAY_RAIL_ITEMS: { pane: TodayRailPane; label: string; icon: JSX.Element }[] = [
    { pane: 'home', label: 'Home', icon: <IconHome /> },
    { pane: 'spaces', label: 'Spaces', icon: <IconChat /> },
    { pane: 'views', label: 'Views', icon: <IconGridMasonry /> },
    { pane: 'library', label: 'Library', icon: <IconBook /> },
    { pane: 'tools', label: 'Tools', icon: <IconWrench /> },
]
