import { $, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { addFlight, FlightsPage, FREE_TRIP_LIMIT, TravelPage, TripEditPage } from '../../src/pages/TravelPages.js';
import { Alert, goBack, hideKeyboard, tap, waitFor, waitGone } from '../../src/pages/base.js';
import { byTextContains, byTextMatches } from '../../src/support/selectors.js';
import { t } from '../../src/support/strings.js';

async function openFlights() {
  await TabBar.open('travel');
  await TravelPage.open('flights');
  await FlightsPage.waitForShown();
}

describe('Travel hub and flights', () => {
  before(async () => {
    await App.reset();
  });

  it('[UI-FLT-001] the Travel hub shows Flights, Travel costs, Route videos and the coming-soon tickets card', async () => {
    await TabBar.open('travel');
    await TravelPage.waitForShown();
    await expect($(TravelPage.flightsCount(0))).toBeDisplayed();
    await expect($(TravelPage.groupsCount(0))).toBeDisplayed();
    await expect($(TravelPage.videosCount(0))).toBeDisplayed();
    await expect($(TravelPage.comingSoon())).toBeDisplayed();
  });

  it('[UI-FLT-002] with no flights the list shows the empty state', async () => {
    await openFlights();
    await expect($(FlightsPage.empty())).toBeDisplayed();
  });

  it('[UI-FLT-003] saving a flight without airports is rejected', async () => {
    await FlightsPage.openAdd();
    await TripEditPage.waitForShown();
    await TripEditPage.save();
    const alert = await Alert.waitFor();
    expect(alert.title || alert.message).toBe(t('trips.missingAirports'));
    await Alert.dismiss();
  });

  it('[UI-FLT-004] the same departure and arrival airport is rejected', async () => {
    await TripEditPage.chooseFrom('MAD');
    await TripEditPage.chooseTo('MAD');
    await TripEditPage.save();
    const alert = await Alert.waitFor();
    expect(alert.title || alert.message).toBe(t('trips.sameAirport'));
    await Alert.dismiss();
    await goBack();
    await FlightsPage.waitForShown();
  });

  it('[UI-FLT-005] adding a flight normalises the flight number, suggests the airline and shows distance and time', async () => {
    await FlightsPage.openAdd();
    await TripEditPage.waitForShown();
    await TripEditPage.setFlightNumber('ba 112');
    await hideKeyboard();
    expect(await TripEditPage.valueOf(TripEditPage.flightNumber())).toBe('BA112');
    expect(await TripEditPage.valueOf(TripEditPage.airline())).toBe('British Airways');
    await TripEditPage.chooseFrom('JFK');
    await TripEditPage.chooseTo('LHR');
    await TripEditPage.chooseCabin('business');
    await TripEditPage.save();
    await FlightsPage.waitForShown();
    await waitFor(FlightsPage.card('BA112 · British Airways'));
    // Great-circle JFK-LHR is about 5,540 km
    await waitFor(byTextMatches('^5[.,\\s]?5\\d\\d km · \\d+h \\d+m$'));
    await expect($(FlightsPage.freeCounter(1))).toBeDisplayed();
  });

  it('[UI-FLT-006] a new flight marks both airports\' countries as visited', async () => {
    await TabBar.open('map');
    await MapPage.expectCountries(2);
  });

  it('[UI-FLT-007] editing a flight saves the seat in capitals', async () => {
    await openFlights();
    await tap(FlightsPage.card('BA112 · British Airways'));
    await TripEditPage.waitForShown(true);
    await TripEditPage.setSeat('12a');
    await TripEditPage.save();
    await FlightsPage.waitForShown();
    await waitFor(byTextContains(`${t('trips.seat')} 12A`));
  });

  it('[UI-FLT-008] deleting a flight asks for confirmation and removes it', async () => {
    await tap(FlightsPage.card('BA112 · British Airways'));
    await TripEditPage.waitForShown(true);
    await TripEditPage.deleteTrip();
    const alert = await Alert.waitFor();
    expect(alert.title || alert.message).toBe(t('trips.deleteConfirm'));
    await Alert.press(t('common.delete'));
    await FlightsPage.waitForShown();
    await waitFor(FlightsPage.empty());
  });

  it(`[UI-FLT-009] free users can log ${FREE_TRIP_LIMIT} flights; the next one opens the Premium offer`, async () => {
    const routes = [['MAD', 'BCN'], ['LIS', 'OPO'], ['NRT', 'KIX'], ['SYD', 'MEL'], ['SJO', 'PTY']];
    for (const [from, to] of routes) await addFlight({ from, to });
    await waitFor(FlightsPage.limitReached());
    await FlightsPage.openAdd();
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
    await waitGone(TripEditPage.title(false), 5_000);
  });
});
