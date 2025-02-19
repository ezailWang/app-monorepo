import React, { ReactElement } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';
import { PermissionsAndroid } from 'react-native';
import Modal from 'react-native-modal';
import RootSiblingsManager from 'react-native-root-siblings';

import DialogManager from '@onekeyhq/components/src/DialogManager';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NeedBridgeDialog from '@onekeyhq/kit/src/components/NeedBridgeDialog';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { getAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { HardwareUiEventPayload } from '@onekeyhq/kit/src/store/reducers/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HandlerClosePassphraseView from './HandlerClosePassphrase';
import HandlerFirmwareUpgradeView from './HandlerFirmwareUpgrade';
import HandlerOpenPassphraseView from './HandlerOpenPassphrase';
import RequestConfirmView from './RequestConfirm';
import RequestPassphraseOnDeviceView from './RequestPassphraseOnDevice';
import RequestPinView from './RequestPin';

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
  content?: string;
};
export type PopupType = 'normal' | 'input';

export const CUSTOM_UI_RESPONSE = {
  // monorepo custom
  CUSTOM_CANCEL: 'ui-custom_cancel',
  CUSTOM_NEED_ONEKEY_BRIDGE: 'ui-custom_need_onekey_bridge',
  CUSTOM_NEED_UPGRADE_FIRMWARE: 'ui-custom_need_upgrade_firmware',
  CUSTOM_NEED_OPEN_PASSPHRASE: 'ui-custom_need_open_passphrase',
  CUSTOM_NEED_CLOSE_PASSPHRASE: 'ui-custom_need_close_passphrase',
};

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',
  REQUEST_PASSPHRASE_ON_DEVICE: 'ui-request_passphrase_on_device',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;

let hardwarePopupHolder: RootSiblingsManager | null = null;
export function closeHardwarePopup() {
  if (hardwarePopupHolder) {
    hardwarePopupHolder.destroy();
    hardwarePopupHolder = null;
  }
}
let lastParams = '';
let lastCallTime = 0;
export default async function showHardwarePopup({
  uiRequest,
  payload,
  content,
}: HardwarePopup) {
  if (!uiRequest) {
    return;
  }
  const currentCallTime = Date.now();
  const currentParams = JSON.stringify({ uiRequest, payload });
  if (currentCallTime - lastCallTime < 1000 && lastParams === currentParams) {
    // ignore frequent calls
    return;
  }
  lastCallTime = currentCallTime;
  lastParams = currentParams;
  let popupType = 'normal';
  let popupView: ReactElement | undefined;

  const { engine, serviceHardware } = backgroundApiProxy;

  const handleCancelPopup = () => {
    closeHardwarePopup();

    try {
      const connectId = payload?.deviceConnectId ?? '';
      // Cancel the process
      serviceHardware.cancel(connectId);
      // Refresh the hardware screen
      serviceHardware.getFeatures(connectId);
    } catch (e) {
      // TODO Collect the error
    }
  };

  if (uiRequest === UI_REQUEST.REQUEST_PIN) {
    const deviceType = payload?.deviceType ?? 'classic';

    let onDeviceInputPin = true;
    if (payload?.deviceId) {
      try {
        const device = await engine.getHWDeviceByDeviceId(payload?.deviceId);
        onDeviceInputPin = device?.payload?.onDeviceInputPin ?? true;
      } catch {
        onDeviceInputPin = true;
      }
    }
    popupType = onDeviceInputPin ? 'normal' : 'input';

    popupView = (
      <RequestPinView
        deviceType={deviceType}
        onDeviceInput={onDeviceInputPin}
        onCancel={() => {
          handleCancelPopup();
        }}
        onConfirm={(pin) => {
          serviceHardware?.sendUiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: pin,
          });
          closeHardwarePopup();
        }}
        onDeviceInputChange={(onDeviceInput) => {
          popupType = onDeviceInputPin ? 'normal' : 'input';
          if (!onDeviceInput) return;

          serviceHardware.sendUiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
          });
        }}
      />
    );
  }

  if (uiRequest === UI_REQUEST.REQUEST_BUTTON) {
    const deviceType = payload?.deviceType ?? 'classic';

    popupView = (
      <RequestConfirmView
        deviceType={deviceType}
        bootLoader={payload?.deviceBootLoaderMode}
        onCancel={() => {
          handleCancelPopup();
        }}
      />
    );
  }

  if (uiRequest === UI_REQUEST.REQUEST_PASSPHRASE_ON_DEVICE) {
    const deviceType = payload?.deviceType ?? 'classic';

    popupView = (
      <RequestPassphraseOnDeviceView
        deviceType={deviceType}
        passphraseState={payload?.passphraseState}
        onCancel={() => {
          handleCancelPopup();
        }}
      />
    );
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_UPGRADE_FIRMWARE) {
    DialogManager.show({
      render: (
        <HandlerFirmwareUpgradeView
          deviceId={payload?.deviceId ?? ''}
          content={content ?? ''}
          onClose={() => {
            closeHardwarePopup();
          }}
        />
      ),
    });
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_CLOSE_PASSPHRASE) {
    DialogManager.show({
      render: (
        <HandlerClosePassphraseView
          deviceConnectId={payload?.deviceConnectId ?? ''}
          onClose={() => {
            closeHardwarePopup();
          }}
        />
      ),
    });
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_OPEN_PASSPHRASE) {
    DialogManager.show({
      render: (
        <HandlerOpenPassphraseView
          deviceConnectId={payload?.deviceConnectId ?? ''}
          onClose={() => {
            closeHardwarePopup();
          }}
        />
      ),
    });
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_ONEKEY_BRIDGE) {
    DialogManager.show({
      render: <NeedBridgeDialog />,
    });
    return;
  }

  if (
    uiRequest === UI_REQUEST.LOCATION_PERMISSION ||
    uiRequest === UI_REQUEST.BLUETOOTH_PERMISSION
  ) {
    const check = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (check || platformEnv.isNativeIOS) {
      DialogManager.show({
        render: (
          <PermissionDialog
            type="bluetooth"
            onClose={() => {
              getAppNavigation().goBack();
              closeHardwarePopup();
            }}
          />
        ),
      });
      return;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      result === PermissionsAndroid.RESULTS.DENIED
    ) {
      DialogManager.show({
        render: (
          <PermissionDialog
            type="location"
            onClose={() => {
              getAppNavigation()?.goBack();
              closeHardwarePopup();
            }}
          />
        ),
      });
    } else {
      closeHardwarePopup();
    }
    return;
  }

  if (!popupView) {
    return setTimeout(() => {
      closeHardwarePopup();
    });
  }

  const nativeInputContentAlign = platformEnv.isNative ? 'flex-end' : 'center';
  const modalTop = platformEnv.isNativeIOS ? 42 : 10;

  setTimeout(() => {
    const modalPopup = (
      <Modal
        isVisible
        onModalHide={closeHardwarePopup}
        backdropColor="overlay"
        animationOut={popupType === 'normal' ? 'fadeOutDown' : 'fadeOutUp'}
        animationIn={popupType === 'normal' ? 'fadeInDown' : 'fadeInUp'}
        animationOutTiming={300}
        backdropTransitionOutTiming={0}
        coverScreen
        useNativeDriver
        hideModalContentWhileAnimating
        style={{
          justifyContent:
            popupType === 'normal' ? 'flex-start' : nativeInputContentAlign,
          alignItems: 'center',
          padding: 0,
          margin: 0,
          top: popupType === 'normal' ? modalTop : 0,
        }}
      >
        {popupView}
      </Modal>
    );
    if (hardwarePopupHolder) {
      hardwarePopupHolder.update(modalPopup);
    } else {
      hardwarePopupHolder = new RootSiblingsManager(modalPopup);
    }
  });

  return hardwarePopupHolder;
}
