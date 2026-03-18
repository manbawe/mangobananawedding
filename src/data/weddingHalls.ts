/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeddingHall = {
  id: string;
  name: string;
  province: string;
  city: string;
  address?: string;
};

export const WEDDING_HALLS: WeddingHall[] = [];
