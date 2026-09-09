// Ponto de entrada usado só pelos testes: junta os módulos puros num bundle CJS
// para o Node conseguir carregá-los sem Electron e sem Firebase.
export * from '../src/js/merge-core.js';
export { StorageService } from '../src/js/storage.js';
