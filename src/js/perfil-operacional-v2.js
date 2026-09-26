// O perfil do PDV continua sendo o normal. A adesão é específica da loja e
// persistida apenas após a conferência do corte; autorização vem do servidor.
export function usarPdvOficialV2() {
  if (typeof window === 'undefined' || !window.electronAPI || window.electronAPI.ambienteTeste === true) return false;
  try {
    const marker = JSON.parse(localStorage.getItem('flowpdv_operacao_oficial_v2') || 'null');
    const license = JSON.parse(localStorage.getItem('adega_licenca') || 'null');
    return marker?.schema === 1 && Boolean(marker.lojaId)
      && marker.chaveLicenca
      && Number.isSafeInteger(marker.revisao) && marker.revisao > 0
      && marker.deviceId === localStorage.getItem('flowpdv_device_id')
      && (license?.chaveLicenca || license?.clienteId) === marker.chaveLicenca;
  } catch { return false; }
}
export function usarFluxoOperacionalV2() {
  return typeof window !== 'undefined' && (window.electronAPI?.ambienteTeste === true || usarPdvOficialV2());
}
export function usarAplicativoIntegradoV2() {
  return typeof window !== 'undefined' && ((window.electronAPI?.ambienteTeste === true && window.electronAPI?.aplicativoCompletoTeste === true) || usarPdvOficialV2());
}
