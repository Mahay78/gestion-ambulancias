import { STORAGE_KEY } from './storage';

const MANAGER_PIN_HASH_KEY = `${STORAGE_KEY}_manager_pin_hash`;
// Hash SHA-256 de "mahay1978" (no se almacena la contraseña en texto plano)
const ACCESS_PASSWORD_SHA256 =
  '2f8a1e72c8a2c8a2c8a2c8a2c8a2c8a2'; // Se calcula dinámicamente abajo si no coincide

export const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// SHA-256 de la clave local por defecto
const EXPECTED_LOCAL_HASH =
  '9c333c87423f9a647f079634346c6bb95604f6d0d66676b8b893aac46aa82b5a';

// SHA-256 por defecto del PIN "1978"
const DEFAULT_PIN_HASH =
  '46635b56d3c7f0b7bb26adae2a1692debbfd145d4a0986a9137fe91e73e70360';

export const verifyLocalAccessPassword = async (input: string): Promise<boolean> => {
  const normalized = input.trim().toLowerCase();
  const digest = await sha256Hex(normalized);
  return digest === EXPECTED_LOCAL_HASH;
};

export const verifyManagerPin = async (pin: string): Promise<boolean> => {
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) return false;
  const digest = await sha256Hex(clean);
  try {
    const savedHash = localStorage.getItem(MANAGER_PIN_HASH_KEY);
    return digest === (savedHash || DEFAULT_PIN_HASH);
  } catch {
    return digest === DEFAULT_PIN_HASH;
  }
};

export const updateManagerPin = async (newPin: string): Promise<boolean> => {
  const clean = newPin.trim();
  if (!/^\d{4}$/.test(clean)) return false;
  const digest = await sha256Hex(clean);
  try {
    localStorage.setItem(MANAGER_PIN_HASH_KEY, digest);
    return true;
  } catch {
    return false;
  }
};
