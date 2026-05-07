export type DeploymentMode = 'saas' | 'self_hosted'

export function getDeploymentMode(): DeploymentMode {
  const m = process.env.DEPLOYMENT_MODE
  return m === 'self_hosted' ? 'self_hosted' : 'saas'
}

export const isSaaS = () => getDeploymentMode() === 'saas'
export const isSelfHosted = () => getDeploymentMode() === 'self_hosted'
