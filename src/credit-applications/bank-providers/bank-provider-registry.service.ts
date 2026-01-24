import { BadRequestException, Injectable } from '@nestjs/common';

import type { BankProvider } from './bank-provider.interface';
import { EsBankProvider } from './es-bank.provider';
import { MxBankProvider } from './mx-bank.provider';

@Injectable()
export class BankProviderRegistryService {
  private readonly providers: Record<string, BankProvider> = {
    ES: new EsBankProvider(),
    MX: new MxBankProvider(),
  };

  resolve(countryCode: string): BankProvider {
    const normalized = countryCode.trim().toUpperCase();
    const provider = this.providers[normalized];
    if (!provider) {
      throw new BadRequestException(`Unsupported country code: ${normalized}`);
    }
    return provider;
  }
}

