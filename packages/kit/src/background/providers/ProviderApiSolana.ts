/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import bs58 from 'bs58';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';

import { IMPL_SOL } from '@onekeyhq/engine/src/constants';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getActiveWalletAccount } from '../../hooks/redux';
import { backgroundClass, providerApiMethod } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

type SolanaSendOptions = {
  /** disable transaction verification step */
  skipPreflight?: boolean;
  /** preflight commitment level */
  preflightCommitment?: string;
  /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
  maxRetries?: number;
};

@backgroundClass()
class ProviderApiSolana extends ProviderApiBase {
  public providerName = IInjectedProviderNames.solana;

  private getConnectedAcccountPublicKey(
    request: IJsBridgeMessagePayload,
  ): Promise<string> {
    const [account] =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_SOL,
      });

    return Promise.resolve(account?.address ?? '');
  }

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: [
            {
              publicKey: await this.getConnectedAcccountPublicKey({ origin }),
            },
          ].filter((item) => !!item.publicKey),
        },
      };
      return result;
    };

    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId } = getActiveWalletAccount();

    debugLogger.providerApi.info('solana rpcCall:', request, { networkId });
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('solana rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_SOL,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_SOL })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('solana disconnect', origin);
  }

  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string },
  ) {
    if (typeof params.message !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }

    // TODO: sign only, not send
    const rawTx = (await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: params.message,
        signOnly: true,
      },
    )) as string;
    // Signed transaction is base64 encoded, inpage provider expects base58.
    return bs58.encode(Buffer.from(rawTx, 'base64'));
  }

  @providerApiMethod()
  public async signAllTransactions(
    request: IJsBridgeMessagePayload,
    params: { message: string[] },
  ) {
    const { message: txsToBeSigned } = params;

    if (
      !isArray(txsToBeSigned) ||
      txsToBeSigned.length === 0 ||
      !txsToBeSigned.every(isString)
    ) {
      throw web3Errors.rpc.invalidInput();
    }

    debugLogger.providerApi.info('solana signAllTransactions', request, params);

    const ret = [];
    for (const tx of txsToBeSigned) {
      ret.push(await this.signTransaction(request, { message: tx }));
    }
    return ret;
  }

  @providerApiMethod()
  public async signAndSendTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string; options?: SolanaSendOptions },
  ) {
    const { message } = params;

    if (!isString(message)) {
      throw web3Errors.rpc.invalidInput();
    }

    const publicKey = await this.getConnectedAcccountPublicKey(request);
    const txid = (await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: message,
      },
    )) as string;
    // todo: validate message is  transactions
    debugLogger.providerApi.info('solana signTransaction', request, params);
    return {
      signature: txid,
      publicKey,
    };
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: {
      message: string;
      display?: 'hex' | 'utf8';
    },
  ) {
    const { message, display = 'utf8' } = params;

    if (!isString(message) || !['utf8', 'hex'].includes(display)) {
      throw web3Errors.rpc.invalidInput();
    }

    debugLogger.providerApi.info('solana signMessage', request, params);
    const publicKey = await this.getConnectedAcccountPublicKey(request);
    const signature =
      await this.backgroundApi.serviceDapp?.openSignAndSendModal(request, {
        unsignedMessage: {
          // Use ETH_SIGN to sign plain message
          type: ETHMessageTypes.ETH_SIGN,
          // TODO: different display needed?
          message: bs58.decode(message).toString(),
        },
      });
    return { signature, publicKey };
  }

  @providerApiMethod()
  public async connect(
    request: IJsBridgeMessagePayload,
    params?: { onlyIfTrusted: boolean },
  ) {
    const { onlyIfTrusted = false } = params || {};

    let publicKey = await this.getConnectedAcccountPublicKey(request);
    if (!publicKey && !onlyIfTrusted) {
      await this.backgroundApi.serviceDapp.openConnectionModal(request);
      publicKey = await this.getConnectedAcccountPublicKey(request);
    }

    if (!publicKey) {
      throw web3Errors.provider.userRejectedRequest();
    }

    return { publicKey };
  }
}

export default ProviderApiSolana;
