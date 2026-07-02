/**
 * Server-safe wallet availability checks.
 * For connect/sign flows import `@/lib/wallet-connection-client` in client components.
 */
export {
  getWalletConnectProjectId,
  isWalletConnectConfigured,
  isWalletUiAvailable,
} from "@/lib/wallet-connect-env";