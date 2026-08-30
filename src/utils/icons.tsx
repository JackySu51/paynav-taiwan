import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Landmark,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Smartphone,
  Store,
  TrainFront,
  Wallet,
} from 'lucide-react';

/**
 * rules.json 的 iconName（kebab-case）對應到實際的 lucide 元件。
 * 找不到時退回錢包圖示，資料端新增支付工具也不會炸掉畫面。
 */
const ICON_MAP: Record<string, LucideIcon> = {
  'qr-code': QrCode,
  'message-circle': MessageCircle,
  'shopping-bag': ShoppingBag,
  'train-front': TrainFront,
  store: Store,
  landmark: Landmark,
  smartphone: Smartphone,
  'credit-card': CreditCard,
  wallet: Wallet,
};

export function getPaymentIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Wallet;
}
