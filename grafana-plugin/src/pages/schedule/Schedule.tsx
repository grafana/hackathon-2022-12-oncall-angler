import React from 'react';

import { Button, HorizontalGroup, VerticalGroup, IconButton, ToolbarButton, Icon, Modal } from '@grafana/ui';
import { PluginPage } from 'PluginPage';
import cn from 'classnames/bind';
import dayjs from 'dayjs';
import { observer } from 'mobx-react';

import PageErrorHandlingWrapper from 'components/PageErrorHandlingWrapper/PageErrorHandlingWrapper';
import PluginLink from 'components/PluginLink/PluginLink';
import ScheduleWarning from 'components/ScheduleWarning/ScheduleWarning';
import Text from 'components/Text/Text';
import UserTimezoneSelect from 'components/UserTimezoneSelect/UserTimezoneSelect';
import WithConfirm from 'components/WithConfirm/WithConfirm';
import Rotations from 'containers/Rotations/Rotations';
import ScheduleFinal from 'containers/Rotations/ScheduleFinal';
import ScheduleOverrides from 'containers/Rotations/ScheduleOverrides';
import ScheduleForm from 'containers/ScheduleForm/ScheduleForm';
import ScheduleICalSettings from 'containers/ScheduleIcalLink/ScheduleIcalLink';
import UsersTimezones from 'containers/UsersTimezones/UsersTimezones';
import { Schedule, ScheduleType, Shift } from 'models/schedule/schedule.types';
import { Timezone } from 'models/timezone/timezone.types';
import { pages } from 'pages';
import { PageProps, WithStoreProps } from 'state/types';
import { withMobXProviderContext } from 'state/withStore';
import LocationHelper from 'utils/LocationHelper';
import { isUserActionAllowed, UserActions } from 'utils/authorization';

import { getStartOfWeek } from './Schedule.helpers';

import styles from './Schedule.module.css';

const cx = cn.bind(styles);

interface SchedulePageProps extends PageProps, WithStoreProps {}

interface SchedulePageState {
  startMoment: dayjs.Dayjs;
  schedulePeriodType: string;
  renderType: string;
  shiftIdToShowRotationForm?: Shift['id'];
  shiftIdToShowOverridesForm?: Shift['id'];
  isLoading: boolean;
  showEditForm: boolean;
  showScheduleICalSettings: boolean;
}

@observer
class SchedulePage extends React.Component<SchedulePageProps, SchedulePageState> {
  constructor(props: SchedulePageProps) {
    super(props);

    const { store } = this.props;
    this.state = {
      startMoment: getStartOfWeek(store.currentTimezone),
      schedulePeriodType: 'week',
      renderType: 'timeline',
      shiftIdToShowRotationForm: undefined,
      shiftIdToShowOverridesForm: undefined,
      isLoading: true,
      showEditForm: false,
      showScheduleICalSettings: false,
    };
  }

  async componentDidMount() {
    const {
      store,
      query: { id },
    } = this.props;

    store.userStore.updateItems();

    store.scheduleStore.updateFrequencyOptions();
    store.scheduleStore.updateDaysOptions();
    await store.scheduleStore.updateOncallShifts(id); // TODO we should know shifts to render Rotations
    await this.updateEvents();

    this.setState({ isLoading: false });
  }

  componentWillUnmount() {
    const { store } = this.props;

    store.scheduleStore.clearPreview();
  }

  render() {
    const {
      store,
      query: { id: scheduleId },
    } = this.props;

    const {
      startMoment,

      shiftIdToShowRotationForm,
      shiftIdToShowOverridesForm,
      showEditForm,
      showScheduleICalSettings,
    } = this.state;

    const { scheduleStore, currentTimezone } = store;

    const users = store.userStore.getSearchResult().results;
    const schedule = scheduleStore.items[scheduleId];

    const disabled =
      !isUserActionAllowed(UserActions.SchedulesWrite) ||
      schedule?.type !== ScheduleType.API ||
      shiftIdToShowRotationForm ||
      shiftIdToShowOverridesForm;

    return (
      <PluginPage pageNav={pages['schedule'].getPageNav()}>
        <PageErrorHandlingWrapper pageName="schedules">
          {() => (
            <>
              <div className={cx('root')}>
                <VerticalGroup spacing="lg">
                  <div className={cx('header')}>
                    <HorizontalGroup justify="space-between">
                      <HorizontalGroup>
                        <PluginLink query={{ page: 'schedules' }}>
                          <IconButton style={{ marginTop: '5px' }} name="arrow-left" size="xl" />
                        </PluginLink>
                        <Text.Title
                          editable
                          editModalTitle="Schedule name"
                          level={2}
                          onTextChange={this.handleNameChange}
                        >
                          {schedule?.name}
                        </Text.Title>
                        {schedule && <ScheduleWarning item={schedule} />}
                      </HorizontalGroup>
                      <HorizontalGroup spacing="lg">
                        {users && (
                          <HorizontalGroup>
                            <Text type="secondary">Current timezone:</Text>
                            <UserTimezoneSelect
                              value={currentTimezone}
                              users={users}
                              onChange={this.handleTimezoneChange}
                            />
                          </HorizontalGroup>
                        )}
                        <HorizontalGroup>
                          <HorizontalGroup>
                            <Button variant="secondary" onClick={this.handleExportClick()}>
                              Export
                            </Button>
                            {(schedule?.type === ScheduleType.Ical || schedule?.type === ScheduleType.Calendar) && (
                              <Button variant="secondary" onClick={this.handleReloadClick(scheduleId)}>
                                Reload
                              </Button>
                            )}
                          </HorizontalGroup>
                          <ToolbarButton
                            icon="cog"
                            tooltip="Settings"
                            onClick={() => {
                              this.setState({ showEditForm: true });
                            }}
                          />
                          <WithConfirm>
                            <ToolbarButton icon="trash-alt" tooltip="Delete" onClick={this.handleDelete} />
                          </WithConfirm>
                        </HorizontalGroup>
                      </HorizontalGroup>
                    </HorizontalGroup>
                  </div>
                  <div className={cx('users-timezones')}>
                    <UsersTimezones
                      scheduleId={scheduleId}
                      startMoment={startMoment}
                      onCallNow={schedule?.on_call_now || []}
                      userIds={
                        scheduleStore.relatedUsers[scheduleId]
                          ? Object.keys(scheduleStore.relatedUsers[scheduleId])
                          : []
                      }
                      tz={currentTimezone}
                      onTzChange={this.handleTimezoneChange}
                    />
                  </div>

                  <div className={cx('rotations')}>
                    <div className={cx('controls')}>
                      <HorizontalGroup justify="space-between">
                        <HorizontalGroup>
                          <Button variant="secondary" onClick={this.handleTodayClick}>
                            Today
                          </Button>
                          <HorizontalGroup spacing="xs">
                            <Button variant="secondary" onClick={this.handleLeftClick}>
                              <Icon name="angle-left" />
                            </Button>
                            <Button variant="secondary" onClick={this.handleRightClick}>
                              <Icon name="angle-right" />
                            </Button>
                          </HorizontalGroup>
                          <Text.Title style={{ marginLeft: '8px' }} level={4} type="primary">
                            {startMoment.format('DD MMM')} - {startMoment.add(6, 'day').format('DD MMM')}
                          </Text.Title>
                        </HorizontalGroup>
                      </HorizontalGroup>
                    </div>
                    <ScheduleFinal
                      scheduleId={scheduleId}
                      currentTimezone={currentTimezone}
                      startMoment={startMoment}
                      onClick={this.handleShowForm}
                      disabled={disabled}
                    />
                    <Rotations
                      scheduleId={scheduleId}
                      currentTimezone={currentTimezone}
                      startMoment={startMoment}
                      onCreate={this.handleCreateRotation}
                      onUpdate={this.handleUpdateRotation}
                      onDelete={this.handleDeleteRotation}
                      shiftIdToShowRotationForm={shiftIdToShowRotationForm}
                      onShowRotationForm={this.handleShowRotationForm}
                      disabled={disabled}
                    />
                    <ScheduleOverrides
                      scheduleId={scheduleId}
                      currentTimezone={currentTimezone}
                      startMoment={startMoment}
                      onCreate={this.handleCreateOverride}
                      onUpdate={this.handleUpdateOverride}
                      onDelete={this.handleDeleteOverride}
                      shiftIdToShowRotationForm={shiftIdToShowOverridesForm}
                      onShowRotationForm={this.handleShowOverridesForm}
                      disabled={disabled}
                    />
                  </div>
                </VerticalGroup>
              </div>
              {showEditForm && (
                <ScheduleForm
                  id={schedule.id}
                  onUpdate={this.update}
                  onHide={() => {
                    this.setState({ showEditForm: false });
                  }}
                />
              )}
              {showScheduleICalSettings && (
                <Modal
                  isOpen
                  title="Schedule export"
                  closeOnEscape
                  onDismiss={() => this.setState({ showScheduleICalSettings: false })}
                >
                  <ScheduleICalSettings id={scheduleId} />
                </Modal>
              )}
            </>
          )}
        </PageErrorHandlingWrapper>
      </PluginPage>
    );
  }

  update = () => {
    const { store, query } = this.props;
    const { id: scheduleId } = query;
    const { scheduleStore } = store;

    return scheduleStore.updateItem(scheduleId);
  };

  handleShowForm = async (shiftId: Shift['id'] | 'new') => {
    const {
      store: { scheduleStore },
    } = this.props;

    const shift = await scheduleStore.updateOncallShift(shiftId);

    if (shift.type === 2) {
      this.handleShowRotationForm(shiftId);
    } else if (shift.type === 3) {
      this.handleShowOverridesForm(shiftId);
    }
  };

  handleShowRotationForm = (shiftId: Shift['id'] | 'new') => {
    this.setState({ shiftIdToShowRotationForm: shiftId });
  };

  handleShowOverridesForm = (shiftId: Shift['id'] | 'new') => {
    this.setState({ shiftIdToShowOverridesForm: shiftId });
  };

  handleNameChange = (value: string) => {
    const { store, query } = this.props;
    const { id: scheduleId } = query;

    const schedule = store.scheduleStore.items[scheduleId];

    store.scheduleStore
      .update(scheduleId, { type: schedule.type, name: value })
      .then(() => store.scheduleStore.updateItem(scheduleId));
  };

  updateEvents = () => {
    const {
      store,
      query: { id: scheduleId },
    } = this.props;

    const { startMoment } = this.state;

    store.scheduleStore.updateItem(scheduleId); // to refresh current oncall users
    store.scheduleStore.updateRelatedUsers(scheduleId); // to refresh related users

    return Promise.all([
      store.scheduleStore.updateEvents(scheduleId, startMoment, 'rotation'),
      store.scheduleStore.updateEvents(scheduleId, startMoment, 'override'),
      store.scheduleStore.updateEvents(scheduleId, startMoment, 'final'),
    ]);
  };

  handleCreateRotation = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleCreateOverride = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleUpdateRotation = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleDeleteRotation = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleDeleteOverride = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleUpdateOverride = () => {
    const { store } = this.props;

    this.updateEvents().then(() => {
      store.scheduleStore.clearPreview();
    });
  };

  handleTimezoneChange = (value: Timezone) => {
    const { store } = this.props;

    const oldTimezone = store.currentTimezone;

    this.setState((oldState) => {
      const wDiff = oldState.startMoment.diff(getStartOfWeek(oldTimezone), 'weeks');

      return { ...oldState, startMoment: getStartOfWeek(value).add(wDiff, 'weeks') };
    }, this.updateEvents);

    store.currentTimezone = value;
  };

  handleShedulePeriodTypeChange = (value: string) => {
    this.setState({ schedulePeriodType: value });
  };

  handleRenderTypeChange = (value: string) => {
    this.setState({ renderType: value });
  };

  handleDateRangeUpdate = async () => {
    await this.updateEvents();
    this.forceUpdate();
  };

  handleTodayClick = () => {
    const { store } = this.props;
    this.setState({ startMoment: getStartOfWeek(store.currentTimezone) }, this.handleDateRangeUpdate);
  };

  handleLeftClick = () => {
    const { startMoment } = this.state;
    this.setState({ startMoment: startMoment.add(-7, 'day') }, this.handleDateRangeUpdate);
  };

  handleRightClick = () => {
    const { startMoment } = this.state;
    this.setState({ startMoment: startMoment.add(7, 'day') }, this.handleDateRangeUpdate);
  };

  handleExportClick = () => {
    return () => {
      this.setState({ showScheduleICalSettings: true });
    };
  };

  handleReloadClick = (scheduleId: Schedule['id']) => {
    const { store } = this.props;

    const { scheduleStore } = store;

    return async () => {
      await scheduleStore.reloadIcal(scheduleId);

      store.scheduleStore.updateOncallShifts(scheduleId);
      this.updateEvents();
    };
  };

  handleDelete = () => {
    const {
      store,
      query: { id: scheduleId },
    } = this.props;

    store.scheduleStore.delete(scheduleId).then(() => LocationHelper.update({ page: 'schedules' }, 'replace'));
  };
}

export default withMobXProviderContext(SchedulePage);
