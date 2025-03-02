import React from 'react';

import { Button, LoadingPlaceholder, VerticalGroup } from '@grafana/ui';
import { PluginPage } from 'PluginPage';
import cn from 'classnames/bind';
import { debounce } from 'lodash-es';
import { observer } from 'mobx-react';

import GList from 'components/GList/GList';
import IntegrationsFilters, { Filters } from 'components/IntegrationsFilters/IntegrationsFilters';
import PageErrorHandlingWrapper, { PageBaseState } from 'components/PageErrorHandlingWrapper/PageErrorHandlingWrapper';
import {
  getWrongTeamResponseInfo,
  initErrorDataState,
} from 'components/PageErrorHandlingWrapper/PageErrorHandlingWrapper.helpers';
import Text from 'components/Text/Text';
import Tutorial from 'components/Tutorial/Tutorial';
import { TutorialStep } from 'components/Tutorial/Tutorial.types';
import AlertReceiveChannelCard from 'containers/AlertReceiveChannelCard/AlertReceiveChannelCard';
import AlertRules from 'containers/AlertRules/AlertRules';
import CreateAlertReceiveChannelContainer from 'containers/CreateAlertReceiveChannelContainer/CreateAlertReceiveChannelContainer';
import IntegrationSettings from 'containers/IntegrationSettings/IntegrationSettings';
import { IntegrationSettingsTab } from 'containers/IntegrationSettings/IntegrationSettings.types';
import { WithPermissionControl } from 'containers/WithPermissionControl/WithPermissionControl';
import { AlertReceiveChannel } from 'models/alert_receive_channel';
import { AlertReceiveChannelOption } from 'models/alert_receive_channel/alert_receive_channel.types';
import { pages } from 'pages';
import { PageProps, WithStoreProps } from 'state/types';
import { withMobXProviderContext } from 'state/withStore';
import LocationHelper from 'utils/LocationHelper';
import { UserActions } from 'utils/authorization';

import styles from './Integrations.module.css';

const cx = cn.bind(styles);

interface IntegrationsState extends PageBaseState {
  integrationsFilters: Filters;
  showCreateIntegrationModal: boolean;
  alertReceiveChannelToShowSettings?: AlertReceiveChannel['id'];
  integrationSettingsTab?: IntegrationSettingsTab;
}

interface IntegrationsProps extends WithStoreProps, PageProps {}

@observer
class Integrations extends React.Component<IntegrationsProps, IntegrationsState> {
  state: IntegrationsState = {
    integrationsFilters: { searchTerm: '' },
    showCreateIntegrationModal: false,
    errorData: initErrorDataState(),
  };

  alertReceiveChanneltoPoll: { [key: string]: number } = {};
  alertReceiveChannelTimerId: ReturnType<typeof setTimeout>;

  async componentDidMount() {
    this.update().then(this.parseQueryParams);
  }

  setSelectedAlertReceiveChannel = (alertReceiveChannelId: AlertReceiveChannel['id']) => {
    const { store } = this.props;
    store.selectedAlertReceiveChannel = alertReceiveChannelId;
    LocationHelper.update({ id: alertReceiveChannelId }, 'partial');
  };

  parseQueryParams = async () => {
    this.setState({ errorData: initErrorDataState() }); // reset wrong team error to false on query parse // reset wrong team error to false

    const { store, query } = this.props;
    const { alertReceiveChannelStore } = store;

    const searchResult = alertReceiveChannelStore.getSearchResult();
    let selectedAlertReceiveChannel = store.selectedAlertReceiveChannel;

    if (query.id) {
      let alertReceiveChannel = await alertReceiveChannelStore
        .loadItem(query.id, true)
        .catch((error) => this.setState({ errorData: { ...getWrongTeamResponseInfo(error) } }));

      if (!alertReceiveChannel) {
        return;
      }

      if (alertReceiveChannel.id) {
        selectedAlertReceiveChannel = alertReceiveChannel.id;
      }

      if (query.tab) {
        this.setState({ integrationSettingsTab: query.tab });
        this.setState({ alertReceiveChannelToShowSettings: query.id });
      }
    }

    if (!selectedAlertReceiveChannel) {
      selectedAlertReceiveChannel = searchResult[0]?.id;
    }

    this.setSelectedAlertReceiveChannel(selectedAlertReceiveChannel);
  };

  update = () => {
    const { store } = this.props;
    return store.alertReceiveChannelStore.updateItems();
  };

  componentDidUpdate(prevProps: IntegrationsProps) {
    if (this.props.query.id !== prevProps.query.id) {
      this.parseQueryParams();
    }
    if (this.props.query.tab !== prevProps.query.tab) {
      this.parseQueryParams();
    }
  }

  componentWillUnmount() {
    clearInterval(this.alertReceiveChannelTimerId);
  }

  render() {
    const { store, query } = this.props;
    const {
      integrationsFilters,
      alertReceiveChannelToShowSettings,
      integrationSettingsTab,
      showCreateIntegrationModal,
      errorData,
    } = this.state;

    const { alertReceiveChannelStore } = store;
    const searchResult = alertReceiveChannelStore.getSearchResult();

    return (
      <PluginPage pageNav={pages['integrations'].getPageNav()}>
        <PageErrorHandlingWrapper
          errorData={errorData}
          objectName="integration"
          pageName="integrations"
          itemNotFoundMessage={`Integration with id=${query?.id} is not found. Please select integration from the list.`}
        >
          {() => (
            <>
              <div className={cx('root')}>
                <div className={cx('filters')}>
                  <IntegrationsFilters value={integrationsFilters} onChange={this.handleIntegrationsFiltersChange} />
                </div>
                {searchResult?.length ? (
                  <div className={cx('integrations')}>
                    <div className={cx('integrationsList')}>
                      <WithPermissionControl userAction={UserActions.IntegrationsWrite}>
                        <Button
                          onClick={() => {
                            this.setState({ showCreateIntegrationModal: true });
                          }}
                          icon="plus"
                          className={cx('newIntegrationButton')}
                        >
                          New integration for receiving alerts
                        </Button>
                      </WithPermissionControl>
                      <div className={cx('alert-receive-channels-list')}>
                        <GList
                          autoScroll
                          selectedId={store.selectedAlertReceiveChannel}
                          items={searchResult}
                          itemKey="id"
                          onSelect={this.handleAlertReceiveChannelSelect}
                        >
                          {(item) => (
                            <AlertReceiveChannelCard
                              id={item.id}
                              onShowHeartbeatModal={() => {
                                this.setState({
                                  alertReceiveChannelToShowSettings: item.id,
                                  integrationSettingsTab: IntegrationSettingsTab.Heartbeat,
                                });
                              }}
                            />
                          )}
                        </GList>
                      </div>
                    </div>
                    <div className={cx('alert-rules', 'alertRulesBorder')}>
                      <AlertRules
                        alertReceiveChannelId={store.selectedAlertReceiveChannel}
                        onDelete={this.handleDeleteAlertReceiveChannel}
                        onShowSettings={(integrationSettingsTab?: IntegrationSettingsTab) => {
                          this.setState({
                            alertReceiveChannelToShowSettings: store.selectedAlertReceiveChannel,
                            integrationSettingsTab,
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : searchResult ? (
                  <Tutorial
                    step={TutorialStep.Integrations}
                    title={
                      <VerticalGroup align="center" spacing="lg">
                        <Text type="secondary">No integrations found. Review your filter and team settings.</Text>
                        <WithPermissionControl userAction={UserActions.IntegrationsWrite}>
                          <Button
                            icon="plus"
                            variant="primary"
                            size="lg"
                            onClick={() => {
                              this.setState({ showCreateIntegrationModal: true });
                            }}
                          >
                            New integration for receiving alerts
                          </Button>
                        </WithPermissionControl>
                      </VerticalGroup>
                    }
                  />
                ) : (
                  <LoadingPlaceholder text="Loading..." />
                )}
              </div>
              {alertReceiveChannelToShowSettings && (
                <IntegrationSettings
                  onUpdate={() => {
                    alertReceiveChannelStore.updateItem(alertReceiveChannelToShowSettings);
                  }}
                  startTab={integrationSettingsTab}
                  id={alertReceiveChannelToShowSettings}
                  onHide={() => {
                    this.setState({
                      alertReceiveChannelToShowSettings: undefined,
                      integrationSettingsTab: undefined,
                    });
                    LocationHelper.update({ tab: undefined }, 'partial');
                  }}
                />
              )}
              {showCreateIntegrationModal && (
                <CreateAlertReceiveChannelContainer
                  onHide={() => {
                    this.setState({ showCreateIntegrationModal: false });
                  }}
                  onCreate={this.handleCreateNewAlertReceiveChannel}
                />
              )}
            </>
          )}
        </PageErrorHandlingWrapper>
      </PluginPage>
    );
  }

  handleCreateNewAlertReceiveChannel = (option: AlertReceiveChannelOption) => {
    const { store } = this.props;

    store.alertReceiveChannelStore
      .create({ integration: option.value })
      .then(async (alertReceiveChannel: AlertReceiveChannel) => {
        await store.alertReceiveChannelStore.updateItems();

        this.setSelectedAlertReceiveChannel(alertReceiveChannel.id);

        this.setState({
          alertReceiveChannelToShowSettings: alertReceiveChannel.id,
          integrationSettingsTab: IntegrationSettingsTab.HowToConnect,
        });

        const integration = store.alertReceiveChannelStore.getIntegration(alertReceiveChannel);
        if (integration?.display_name === 'Grafana Alerting') {
          this.alertReceiveChanneltoPoll = { ...this.alertReceiveChanneltoPoll, [alertReceiveChannel.id]: 200 };
          if (!this.alertReceiveChannelTimerId) {
            this.alertReceiveChannelTimerId = setInterval(this.checkTimerTick, 3000);
          }
        }
      });
  };

  checkTimerTick = () => {
    const { store } = this.props;

    if (store.selectedAlertReceiveChannel in this.alertReceiveChanneltoPoll) {
      let counter = this.alertReceiveChanneltoPoll[store.selectedAlertReceiveChannel];
      if (counter > 0) {
        store.alertReceiveChannelStore.updateItem(store.selectedAlertReceiveChannel);
        this.alertReceiveChanneltoPoll[store.selectedAlertReceiveChannel]--;
      } else {
        delete this.alertReceiveChanneltoPoll[store.selectedAlertReceiveChannel];
      }
    }
  };

  handleDeleteAlertReceiveChannel = (alertReceiveChannelId: AlertReceiveChannel['id']) => {
    const { store } = this.props;
    const { alertReceiveChanneltoPoll } = this;

    const { alertReceiveChannelStore } = store;

    if (alertReceiveChanneltoPoll[alertReceiveChannelId]) {
      delete alertReceiveChanneltoPoll[alertReceiveChannelId];
    }

    alertReceiveChannelStore.deleteAlertReceiveChannel(alertReceiveChannelId).then(async () => {
      await alertReceiveChannelStore.updateItems();

      if (alertReceiveChannelId === store.selectedAlertReceiveChannel) {
        const searchResult = alertReceiveChannelStore.getSearchResult();

        this.setSelectedAlertReceiveChannel(searchResult && searchResult[0]?.id);
      }
    });
  };

  applyFilters = () => {
    const { store } = this.props;
    const { alertReceiveChannelStore } = store;
    const { integrationsFilters } = this.state;

    alertReceiveChannelStore.updateItems(integrationsFilters.searchTerm).then(() => {
      const searchResult = alertReceiveChannelStore.getSearchResult();

      if (
        !searchResult.find(
          (alertReceiveChannel: AlertReceiveChannel) => alertReceiveChannel.id === store.selectedAlertReceiveChannel
        )
      ) {
        store.selectedAlertReceiveChannel = searchResult.length ? searchResult[0].id : undefined;
      }
    });
  };

  debouncedUpdateIntegrations = debounce(this.applyFilters, 1000);

  handleIntegrationsFiltersChange = (integrationsFilters: Filters) => {
    this.setState({ integrationsFilters }, this.debouncedUpdateIntegrations);
  };

  handleAlertReceiveChannelSelect = (id: AlertReceiveChannel['id']) => {
    this.setSelectedAlertReceiveChannel(id);
  };
}

export default withMobXProviderContext(Integrations);
