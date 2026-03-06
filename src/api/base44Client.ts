import { appParams } from '@/lib/app-params'

// Mock client pour Base44 (remplacer par le vrai client si disponible)
export const base44 = {
  appId: appParams.appId,
  token: appParams.token,
  functionsVersion: appParams.functionsVersion,
  serverUrl: appParams.appBaseUrl,
}
