import { errors } from "jose";

export function signatureFailure(error: unknown) {
  if (error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWTExpired) {
    return { state: "failed" as const, reason: "A assinatura ou a validade da prova do Google não confere.", retryable: false };
  }
  return { state: "failed" as const, reason: "Não foi possível consultar as chaves do Google. Vamos tentar novamente.", retryable: true };
}
