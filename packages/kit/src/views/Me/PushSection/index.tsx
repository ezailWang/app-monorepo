import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, useTheme } from '@onekeyhq/components';
import Typography, { Text } from '@onekeyhq/components/src/Typography';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

export const PushSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();

  if (!platformEnv.isNative) {
    return null;
  }

  return (
    <Box w="full" mb="6">
      <Box pb="2">
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({
            id: 'form__alert_uppercase',
            defaultMessage: 'ALERT',
          })}
        </Typography.Subheading>
      </Box>
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigation.navigate(HomeRoutes.PushNotification);
          }}
        >
          <Icon name="BellOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__notification',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
};
