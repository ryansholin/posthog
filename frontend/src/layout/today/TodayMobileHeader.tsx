import { useActions, useValues } from 'kea'

import { IconChevronLeft } from '@posthog/icons'
import { Button, Text, Tooltip, TooltipContent, TooltipTrigger } from '@posthog/quill'

import { breadcrumbsLogic } from '~/layout/navigation/Breadcrumbs/breadcrumbsLogic'

import { todayShellLogic } from './todayShellLogic'

/** The bar above a page on phone-width windows. Back returns to the previous page, or to the pane on the first page. */
export function TodayMobileHeader(): JSX.Element {
    const { sceneBreadcrumbs } = useValues(breadcrumbsLogic)
    const { goBackOnMobile } = useActions(todayShellLogic)
    const title = [...sceneBreadcrumbs].reverse().find((breadcrumb) => !!breadcrumb.name)?.name

    return (
        <header className="TodayMobileHeader" data-quill>
            <Tooltip>
                <TooltipTrigger
                    delay={0}
                    render={
                        <Button
                            size="icon-lg"
                            className="rounded-full"
                            aria-label="Back"
                            data-attr="today-mobile-back"
                            onClick={goBackOnMobile}
                        />
                    }
                >
                    <IconChevronLeft />
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
            </Tooltip>
            {title && (
                <Text render={<span />} weight="semibold" className="min-w-0 truncate">
                    {title}
                </Text>
            )}
        </header>
    )
}
