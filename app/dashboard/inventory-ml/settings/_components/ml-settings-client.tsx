"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { updateMLSettings, testMLSettings, resetMLSettings } from "@/app/actions/inventory-ml"
import { Loader2, TestTube, RotateCcw, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface MLSettingsClientProps {
    initialSettings: {
        model: string
        temperature: number
        maxTokens: number
        cacheDuration: number
        thinkingMode: boolean
    }
    userId: string
}

export function MLSettingsClient({ initialSettings, userId }: MLSettingsClientProps) {
    const [settings, setSettings] = useState(initialSettings)
    const [isSaving, setIsSaving] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    // Model options (Requirement 9.3)
    const modelOptions = [
        { value: "qwen/qwen3-32b", label: "Qwen 3 32B (Fast, Balanced)" },
        { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (High Quality)" },
        { value: "mixtral-8x7b", label: "Mixtral 8x7B (Versatile)" }
    ]

    // Cache duration options (Requirement 9.6)
    const cacheDurationOptions = [
        { value: 12, label: "12 hours" },
        { value: 24, label: "24 hours (Recommended)" },
        { value: 48, label: "48 hours" }
    ]

    const handleSave = async () => {
        setIsSaving(true)
        setTestResult(null)

        try {
            const result = await updateMLSettings(settings, userId)

            if (result.success) {
                toast.success(result.message || "Settings saved")
            } else {
                // If error, revert to defaults (Requirement 9.12)
                toast.error(result.error || "Error saving settings")

                // Optionally revert to initial settings
                setSettings(initialSettings)
            }
        } catch (error) {
            toast.error("Failed to save settings. Reverting to previous values.")
            setSettings(initialSettings)
        } finally {
            setIsSaving(false)
        }
    }

    const handleTest = async () => {
        setIsTesting(true)
        setTestResult(null)

        try {
            const result = await testMLSettings({
                model: settings.model,
                temperature: settings.temperature,
                maxTokens: settings.maxTokens
            })

            if (result.success) {
                setTestResult({
                    success: true,
                    message: "Test successful! ML responded correctly with the current parameters."
                })
                toast.success("ML parameters are working correctly")
            } else {
                setTestResult({
                    success: false,
                    message: result.error || "Test failed"
                })
                toast.error(result.error || "Test failed")
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: "Failed to test settings"
            })
            toast.error("Failed to test ML settings")
        } finally {
            setIsTesting(false)
        }
    }

    const handleReset = async () => {
        setIsResetting(true)
        setTestResult(null)

        try {
            const result = await resetMLSettings(userId)

            if (result.success) {
                // Reset local state to defaults
                setSettings({
                    model: "qwen/qwen3-32b",
                    temperature: 0.1,
                    maxTokens: 8192,
                    cacheDuration: 24,
                    thinkingMode: false
                })

                toast.success("ML settings have been reset to defaults")
            } else {
                toast.error(result.error || "Error resetting settings")
            }
        } catch (error) {
            toast.error("Failed to reset settings")
        } finally {
            setIsResetting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Optimal Parameters Recommendation (Requirement 9.11) */}
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recommended Settings</AlertTitle>
                <AlertDescription>
                    For best results: Use Qwen 3 32B model with temperature 0.1-0.2 for replenishment predictions,
                    and 0.2-0.3 for customer recommendations. Higher temperatures (0.5-0.7) provide more creative
                    responses but may be less consistent.
                </AlertDescription>
            </Alert>

            {/* Test Result Display */}
            {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>{testResult.success ? "Test Passed" : "Test Failed"}</AlertTitle>
                    <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>ML Model Configuration</CardTitle>
                    <CardDescription>
                        Configure the ML model and parameters used for inventory predictions
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Model Selection (Requirement 9.3) */}
                    <div className="space-y-2">
                        <Label htmlFor="model">ML Model</Label>
                        <Select
                            value={settings.model}
                            onValueChange={(value) => setSettings({ ...settings, model: value })}
                        >
                            <SelectTrigger id="model">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {modelOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Choose the ML model for generating predictions
                        </p>
                    </div>

                    {/* Temperature Slider (Requirement 9.4) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="temperature">Temperature</Label>
                            <span className="text-sm font-medium">{settings.temperature.toFixed(2)}</span>
                        </div>
                        <Slider
                            id="temperature"
                            min={0}
                            max={1}
                            step={0.05}
                            value={[settings.temperature]}
                            onValueChange={(value) => setSettings({ ...settings, temperature: value[0] })}
                            className="w-full"
                        />
                        <p className="text-sm text-muted-foreground">
                            Lower values (0.0-0.3) are more focused and deterministic. Higher values (0.5-1.0) are more creative.
                        </p>
                    </div>

                    {/* Max Tokens Input (Requirement 9.5) */}
                    <div className="space-y-2">
                        <Label htmlFor="maxTokens">Max Tokens</Label>
                        <Input
                            id="maxTokens"
                            type="number"
                            min={1000}
                            max={8192}
                            step={256}
                            value={settings.maxTokens}
                            onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 1000 })}
                        />
                        <p className="text-sm text-muted-foreground">
                            Maximum length of ML response (1000-8192). Higher values allow longer explanations.
                        </p>
                    </div>

                    {/* Cache Duration (Requirement 9.6) */}
                    <div className="space-y-2">
                        <Label htmlFor="cacheDuration">Cache Duration</Label>
                        <Select
                            value={settings.cacheDuration.toString()}
                            onValueChange={(value) => setSettings({ ...settings, cacheDuration: parseInt(value) })}
                        >
                            <SelectTrigger id="cacheDuration">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {cacheDurationOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value.toString()}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            How long to cache predictions before generating new ones
                        </p>
                    </div>

                    {/* Thinking Mode Toggle (Requirement 9.7) */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="thinkingMode">Thinking Mode</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable ML to show reasoning process (may increase response time)
                            </p>
                        </div>
                        <Switch
                            id="thinkingMode"
                            checked={settings.thinkingMode}
                            onCheckedChange={(checked) => setSettings({ ...settings, thinkingMode: checked })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={handleSave}
                    disabled={isSaving || isTesting || isResetting}
                    className="flex-1"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Settings
                        </>
                    )}
                </Button>

                <Button
                    onClick={handleTest}
                    disabled={isSaving || isTesting || isResetting}
                    variant="outline"
                >
                    {isTesting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <TestTube className="mr-2 h-4 w-4" />
                            Test
                        </>
                    )}
                </Button>

                <Button
                    onClick={handleReset}
                    disabled={isSaving || isTesting || isResetting}
                    variant="outline"
                >
                    {isResetting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting...
                        </>
                    ) : (
                        <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset to Defaults
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
