import React, { useCallback, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Form,
  Modal,
  SegmentedControl,
  useForm,
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useNavigationActions } from '@onekeyhq/kit/src/hooks';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddImportedOrWatchingAccountModal
>;

type AddImportedOrWatchingAccountValues = {
  name: string;
  importAs: number; // A segmented control value.
  networkId: string;
};

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const inputCategories = [
  UserInputCategory.IMPORTED,
  UserInputCategory.WATCHING,
];

const AddImportedOrWatchingAccount = () => {
  const intl = useIntl();
  const toast = useToast();

  const { closeDrawer, openRootHome } = useNavigationActions();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { control, handleSubmit, getValues, watch } =
    useForm<AddImportedOrWatchingAccountValues>();
  const {
    params: { text, checkResults, onSuccess },
  } = useRoute<RouteProps>();

  const { activeNetworkId } = useGeneral();
  const { wallets } = useRuntime();

  const selectableNetworks = useMemo(
    () => [
      ...new Set(
        checkResults.reduce(
          (networks: Array<string>, result) =>
            networks.concat(result.possibleNetworks || []),
          [],
        ),
      ),
    ],
    [checkResults],
  );
  const watchNetwork = watch(
    'networkId',
    activeNetworkId && selectableNetworks.includes(activeNetworkId)
      ? activeNetworkId
      : selectableNetworks[0],
  );
  const possibleAddTypes = useMemo(
    () =>
      checkResults
        .filter(({ possibleNetworks = [] }) =>
          possibleNetworks.includes(watchNetwork),
        )
        .map(({ category }) => category),
    [watchNetwork, checkResults],
  );

  const defaultAccountNames = useMemo(() => {
    const typeToNextIdMap = Object.fromEntries(
      wallets
        .filter((wallet) => ['imported', 'watching'].includes(wallet.type))
        .map((wallet) => [wallet.type, wallet.nextAccountIds.global || '']),
    );
    return [
      typeToNextIdMap.imported ? `Account #${typeToNextIdMap.imported}` : '',
      typeToNextIdMap.watching ? `Account #${typeToNextIdMap.watching}` : '',
    ];
  }, [wallets]);

  const importTypeIndex = useMemo(
    () => getValues('importAs') ?? inputCategories.indexOf(possibleAddTypes[0]),
    [getValues, possibleAddTypes],
  );

  const onSubmit = useCallback(
    async (values: AddImportedOrWatchingAccountValues) => {
      const selectedTypeIndex =
        values.importAs ?? inputCategories.indexOf(possibleAddTypes[0]);
      const importType = inputCategories[selectedTypeIndex];
      const name = values.name || defaultAccountNames[selectedTypeIndex];

      if (importType === UserInputCategory.IMPORTED) {
        navigation.navigate(
          CreateWalletModalRoutes.AddImportedAccountDoneModal,
          {
            privatekey: text,
            networkId: values.networkId,
            name,
            onSuccess,
          },
        );
      } else if (importType === UserInputCategory.WATCHING) {
        try {
          await backgroundApiProxy.serviceAccount.addWatchAccount(
            values.networkId,
            text,
            name,
          );
          closeDrawer();
          openRootHome();
          closeExtensionWindowIfOnboardingFinished();
        } catch (e) {
          const errorKey = (e as { key: LocaleIds }).key;
          toast.show({
            title: intl.formatMessage({ id: errorKey }),
          });
        }
      }
    },
    [
      possibleAddTypes,
      defaultAccountNames,
      navigation,
      text,
      onSuccess,
      closeDrawer,
      openRootHome,
      toast,
      intl,
    ],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({
        id:
          importTypeIndex === 0
            ? 'wallet__imported_accounts'
            : 'wallet__watched_accounts',
      })}
      primaryActionProps={{
        type: 'primary',
        onPromise: handleSubmit(onSubmit),
      }}
      primaryActionTranslationId="action__import"
      hideSecondaryAction
    >
      <Form>
        {selectableNetworks.length === 1 ? undefined : (
          <FormChainSelector
            selectableNetworks={selectableNetworks}
            control={control}
            name="networkId"
          />
        )}
        {possibleAddTypes.length === 1 ? undefined : (
          <Form.Item
            name="importAs"
            label="Import as" // TODO: missing i18n
            control={control}
          >
            <SegmentedControl
              values={[
                intl.formatMessage({ id: 'wallet__imported_accounts' }),
                intl.formatMessage({ id: 'wallet__watched_accounts' }),
              ]}
            />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label={intl.formatMessage({ id: 'form__account_name' })}
          control={control}
        >
          <Form.Input placeholder={defaultAccountNames[importTypeIndex]} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddImportedOrWatchingAccount;
