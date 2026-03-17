declare module "vanta/dist/vanta.clouds.min" {
    const createClouds: (options: Record<string, unknown>) => { destroy?: () => void }
    export default createClouds
}
