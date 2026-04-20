import { getA2RCompetitionData, getA2RCompetitionFilterOptions } from "@/app/actions/a2r-competition"
import { A2RCompetitionClient } from "./_components/a2r-competition-client"

export const metadata = {
    title: "A2R Competition | One Chitra",
    description: "Sales competition dashboard for A2R point calculation",
}

function getDefaultYear(years: number[]) {
    const currentYear = new Date().getFullYear()
    if (years.includes(currentYear)) {
        return currentYear
    }

    return years[0] || currentYear
}

export default async function A2RCompetitionPage() {
    const filterOptions = await getA2RCompetitionFilterOptions()
    const years = filterOptions.success ? filterOptions.data.years : []
    const monthsByYear = filterOptions.success ? filterOptions.data.monthsByYear : {}
    const selectedYear = getDefaultYear(years)
    const selectedMonths = monthsByYear[selectedYear] || ["04"]
    const dataResponse = await getA2RCompetitionData({
        year: selectedYear,
        months: selectedMonths,
    })

    return (
        <div className="flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:p-8 lg:pt-6">
            <A2RCompetitionClient
                initialYear={selectedYear}
                initialMonths={selectedMonths}
                initialYears={years}
                monthsByYear={monthsByYear}
                initialData={dataResponse.success ? dataResponse.data : null}
            />
        </div>
    )
}
