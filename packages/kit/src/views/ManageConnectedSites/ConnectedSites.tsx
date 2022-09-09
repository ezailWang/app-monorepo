import React, { useCallback } from 'react';

import { cloneDeep } from 'lodash';
import { Image } from 'native-base';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { DappSiteConnection } from '@onekeyhq/kit/src/store/reducers/dapp';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { showOverlay } from '../../utils/overlayUtils';

import AddConnectionSiteDialog from './Component/AddConnectionSite';
import ConnectedSitesHeader from './Component/ConnectedSitesHeader';

const sortConnectionsSite = (connections: DappSiteConnection[]) => {
  let parseConnections: DappSiteConnection[] = cloneDeep(connections);
  parseConnections = parseConnections.map<DappSiteConnection>((c) => {
    const { origin } = c.site;
    c.site.hostname = new URL(origin).hostname;
    if (!c.site.icon) c.site.icon = `${origin}/favicon.ico`;
    return c;
  });
  return parseConnections.sort((c1, c2) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    natsort({ insensitive: true })(c1.site.hostname!, c2.site.hostname!),
  );
};

export default function ConnectedSites() {
  const intl = useIntl();
  const connections: DappSiteConnection[] = useAppSelector(
    (s) => s.dapp.connections,
  );
  const sortConnections = sortConnectionsSite(connections);
  // const walletConnectSessions = useAppSelector(
  //   (s) => s.dapp.walletConnectSessions,
  // );

  const openDeleteDialog = useCallback(
    (dappName: string, disconnect: () => Promise<any>) => {
      showOverlay((closeOverlay) => (
        <Dialog
          visible
          onClose={closeOverlay}
          footerButtonProps={{
            primaryActionTranslationId: 'action__disconnect',
            primaryActionProps: {
              type: 'destructive',
              onPromise: async () => {
                await disconnect();
                closeOverlay();
              },
            },
          }}
          contentProps={{
            icon: (
              <Box
                alignItems="center"
                justifyContent="center"
                size="48px"
                overflow="hidden"
                rounded="full"
                backgroundColor="surface-critical-default"
              >
                <Icon name="ConnectOffOutline" size={24} />
              </Box>
            ),
            title: intl.formatMessage({
              id: 'dialog__disconnect_from_this_site',
            }),
            content: intl.formatMessage(
              {
                id: 'dialog__disconnect_all_accounts_desc',
              },
              {
                0: dappName,
              },
            ),
          }}
        />
      ));
    },
    [intl],
  );

  const openAddDialog = useCallback(() => {
    showOverlay((closeOverlay) => (
      <AddConnectionSiteDialog closeOverlay={closeOverlay} />
    ));
  }, []);

  const renderItem: ListRenderItem<DappSiteConnection> = useCallback(
    ({ item, index }) => (
      <Pressable>
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={index === connections?.length - 1 ? '12px' : '0px'}
          borderWidth={1}
          borderTopWidth={index === 0 ? 1 : 0}
          borderBottomWidth={index === connections?.length - 1 ? 1 : 0}
          borderColor="border-subdued"
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            {!!item.site.icon && (
              <Box size="32px" overflow="hidden" rounded="full">
                <Image
                  w="full"
                  h="full"
                  src={item.site.icon}
                  key={item.site.icon}
                  alt={item.site.icon}
                  fallbackElement={<Icon name="ConnectOutline" size={32} />}
                />
              </Box>
            )}
            <Box
              flexDirection="column"
              ml="12px"
              justifyContent="center"
              flex={1}
            >
              <Typography.Body1Strong>
                {item.site.hostname}
              </Typography.Body1Strong>
              <Typography.Body2 color="text-subdued" numberOfLines={1}>
                {shortenAddress(item.address)}
              </Typography.Body2>
            </Box>
            <IconButton
              name="CloseCircleSolid"
              type="plain"
              circle
              onPress={() => {
                openDeleteDialog(item.site.origin, async () => {
                  await backgroundApiProxy.serviceDapp.cancellConnectedSite(
                    item,
                  );
                });
              }}
            />
          </Box>
        </Box>
      </Pressable>
    ),
    [connections.length, openDeleteDialog],
  );
  return (
    <Modal
      hidePrimaryAction
      header={intl.formatMessage({
        id: 'title__connect_sites',
      })}
      footer={null}
      flatListProps={{
        ListHeaderComponent:
          connections.length > 0 ? (
            <ConnectedSitesHeader
              connections={connections}
              onDisConnectWalletConnected={openDeleteDialog}
              onAddConnectSite={openAddDialog}
            />
          ) : null,
        data: sortConnections,
        // @ts-ignore
        renderItem,
        ListEmptyComponent: (
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="503px"
            flex={1}
          >
            <Empty
              icon={<Icon name="InboxOutline" size={48} />}
              title={intl.formatMessage({
                id: 'empty__no_connected_sites',
              })}
              subTitle={intl.formatMessage({
                id: 'empty__no_connected_sites_desc',
              })}
            />
          </Box>
        ),
        ItemSeparatorComponent: Divider,
        showsVerticalScrollIndicator: false,
      }}
    />
  );
}