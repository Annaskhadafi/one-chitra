import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-purple-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-purple-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
        <CardHeader>
          <CardDescription className="text-blue-700 dark:text-blue-300">Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-900 dark:text-blue-100">
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-blue-800 dark:text-blue-200">
            Trending up this month <IconTrendingUp className="size-4" />
          </div>
          <div className="text-blue-600/70 dark:text-blue-400/70">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300">
        <CardHeader>
          <CardDescription className="text-emerald-700 dark:text-emerald-300">New Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-900 dark:text-emerald-100">
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400">
              <IconTrendingDown />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-emerald-800 dark:text-emerald-200">
            Down 20% this period <IconTrendingDown className="size-4" />
          </div>
          <div className="text-emerald-600/70 dark:text-emerald-400/70">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card bg-gradient-to-br from-violet-500/10 via-violet-400/5 to-fuchsia-500/10 border-violet-200/50 dark:from-violet-500/20 dark:via-violet-400/10 dark:to-fuchsia-500/20 dark:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300">
        <CardHeader>
          <CardDescription className="text-violet-700 dark:text-violet-300">Active Accounts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-violet-900 dark:text-violet-100">
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-violet-800 dark:text-violet-200">
            Strong user retention <IconTrendingUp className="size-4" />
          </div>
          <div className="text-violet-600/70 dark:text-violet-400/70">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300">
        <CardHeader>
          <CardDescription className="text-amber-700 dark:text-amber-300">Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-amber-900 dark:text-amber-100">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
              <IconTrendingUp />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-amber-800 dark:text-amber-200">
            Steady performance increase <IconTrendingUp className="size-4" />
          </div>
          <div className="text-amber-600/70 dark:text-amber-400/70">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}
