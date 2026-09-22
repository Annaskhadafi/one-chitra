import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGuard } from "@/components/permission-guard"

export default function CompetitorFormPage() {
    return (
        <PermissionGuard resource="competitor-info-new" action="view">
            <div className="flex flex-col gap-6 p-6 h-full min-h-screen">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Form Competitor</h1>
                    <p className="text-muted-foreground">
                        Input data Price Competitor, Competitor Activity, dan Lost Sale melalui form berikut.
                    </p>
                </div>

                <Tabs defaultValue="price" className="w-full flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 max-w-[580px] mb-4">
                        <TabsTrigger value="price">Price Competitor</TabsTrigger>
                        <TabsTrigger value="activity">Competitor Activity</TabsTrigger>
                        <TabsTrigger value="lostsale">Form Lost Sale</TabsTrigger>
                    </TabsList>

                    <TabsContent value="price" className="flex-1 w-full mt-0">
                        <div className="w-full h-[80vh] rounded-md border overflow-hidden bg-white">
                            <iframe 
                                src="https://docs.google.com/forms/d/1s_Hrh3e99c3SEsfBIwirixavOk97lbi-Lp1CPygjilg/viewform?embedded=true"
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                marginHeight={0} 
                                marginWidth={0}
                                className="w-full h-full"
                            >
                                Loading…
                            </iframe>
                        </div>
                    </TabsContent>

                    <TabsContent value="activity" className="flex-1 w-full mt-0">
                        <div className="w-full h-[80vh] rounded-md border overflow-hidden bg-white">
                            <iframe 
                                src="https://docs.google.com/forms/u/0/d/1UQwpOtvqu-rcfmAGxpwgRc6nuw8x8SRB91GYdrjBDGE/viewform?embedded=true" 
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                marginHeight={0} 
                                marginWidth={0}
                                className="w-full h-full"
                            >
                                Loading…
                            </iframe>
                        </div>
                    </TabsContent>

                    <TabsContent value="lostsale" className="flex-1 w-full mt-0">
                        <div className="w-full h-[80vh] rounded-md border overflow-hidden bg-white">
                            <iframe 
                                src="https://docs.google.com/forms/d/175O3HxFQNBHxXJLO8pjTX97bMfm_UQYuwbEVgy09L90/viewform?embedded=true" 
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                marginHeight={0} 
                                marginWidth={0}
                                className="w-full h-full"
                            >
                                Loading…
                            </iframe>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PermissionGuard>
    )
}
