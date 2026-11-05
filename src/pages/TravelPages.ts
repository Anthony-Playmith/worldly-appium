import { driver } from '@wdio/globals';

import { alertIds, editText, byClass, byId, byLabel, byLabelEnding, byLabelStartsWith, byText, byTextStartsWith, inputAfterLabel } from '../support/selectors.js';
import { t } from '../support/strings.js';
import { anyAlert, hideKeyboard, isShown, scrollIntoView, scrollTapUntil, tap, tapUntil, typeInto, waitFor } from './base.js';

export const FREE_TRIP_LIMIT = 5;

/** Travel hub tab: Flights, Travel costs, Route videos, Onward tickets. */
export const TravelPage = {
  tile: (key: 'flights' | 'costs' | 'videos' | 'tickets') =>
    byText({ flights: t('trips.flights'), costs: t('costs.title'), videos: t('videos.title'), tickets: t('travel.tickets') }[key]),
  flightsCount: (count: number) => byText(t('travel.flightsCount', { count })),
  groupsCount: (count: number) => byText(t('travel.groupsCount', { count })),
  videosCount: (count: number) => byText(t('travel.videosCount', { count })),
  comingSoon: () => byText(t('travel.comingSoon')),

  async waitForShown() {
    await waitFor(this.tile('flights'));
  },
  async open(key: 'flights' | 'costs' | 'videos') {
    await tap(this.tile(key));
  },
};

export const FlightsPage = {
  add: () => byLabel(t('trips.add')),
  empty: () => byText(t('trips.empty')),
  freeCounter: (count: number) => byText(t('trips.freeLimit', { count, limit: FREE_TRIP_LIMIT })),
  limitReached: () => byText(t('trips.limitReached', { limit: FREE_TRIP_LIMIT })),
  /** Trip card, labelled "<flight number> · <airline>, <distance> · <duration>, <from>...". */
  card: (flightAndAirline: string) => byLabelStartsWith(flightAndAirline),
  summaryFlights: (count: number) => byText(String(count)),

  async waitForShown() {
    await waitFor(this.add());
  },
  async openAdd() {
    await tap(this.add());
  },
};

export const AirportPicker = {
  search: () => editText(t('trips.searchAirport')),
  result: (iata: string) => byTextStartsWith(`${iata} · `),
  close: () => byLabel(t('common.close')),

  /** Opens the picker from its field, searches the IATA code and picks the airport. */
  async choose(fieldLabel: string, iata: string) {
    await (await scrollIntoView(`.description(${JSON.stringify(fieldLabel)})`)).click();
    await typeInto(this.search(), iata);
    await waitFor(this.result(iata));
    // The first tap after typing can be used to blur the search box, so tap until the picker closes
    await tapUntil(this.result(iata), byLabel(fieldLabel));
  },
};

export const TripEditPage = {
  title: (existing = false) => byText(t(existing ? 'trips.edit' : 'trips.new')),
  flightNumber: () => inputAfterLabel(t('trips.flightNumber')),
  airline: () => inputAfterLabel(t('trips.airline')),
  seat: () => inputAfterLabel(t('trips.seat')),
  notes: () => inputAfterLabel(t('trips.notes')),
  from: () => byLabel(t('trips.from')),
  to: () => byLabel(t('trips.to')),
  selected: (iata: string) => byTextStartsWith(`${iata} · `),
  cabin: (key: 'economy' | 'premium_economy' | 'business' | 'first') => byLabel(t(`trips.cabin.${key}`)),
  date: () => byLabel(t('trips.date')),
  saveButton: () => byLabel(t('common.save')),
  delete: () => byLabelEnding(t('common.delete')),

  async waitForShown(existing = false) {
    await waitFor(this.title(existing));
  },
  async setFlightNumber(value: string) {
    await typeInto(this.flightNumber(), value);
  },
  async valueOf(selector: string) {
    return (await waitFor(selector)).getText();
  },
  async chooseFrom(iata: string) {
    await AirportPicker.choose(t('trips.from'), iata);
  },
  async chooseTo(iata: string) {
    await AirportPicker.choose(t('trips.to'), iata);
  },
  async chooseCabin(key: 'economy' | 'premium_economy' | 'business' | 'first') {
    await tap(this.cabin(key));
  },
  /** Opens the native date picker and confirms the preselected date (today). */
  async pickTodayAsDate() {
    await tap(this.date());
    await tap(byId(alertIds.positive));
  },
  /** Types the seat; the empty seat field shows the "12A" placeholder. */
  async setSeat(value: string) {
    await (await scrollIntoView('.className("android.widget.EditText").text("12A")')).setValue(value);
    await hideKeyboard();
  },
  /** Saves; ends on a validation alert or back on the flights list. */
  async save() {
    await hideKeyboard();
    await scrollTapUntil(`.description(${JSON.stringify(t('common.save'))})`, [...anyAlert(), FlightsPage.add()]);
  },
  /** Taps Delete; ends on the confirmation alert. */
  async deleteTrip() {
    await hideKeyboard();
    await scrollTapUntil(`.descriptionContains(${JSON.stringify(t('common.delete'))})`, anyAlert());
  },
  async isOpen() {
    return isShown(this.saveButton());
  },
};

/** Adds a flight through the form. */
export async function addFlight(trip: { from: string; to: string; flightNumber?: string; cabin?: 'economy' | 'business' }) {
  await FlightsPage.openAdd();
  await TripEditPage.waitForShown();
  if (trip.flightNumber) await TripEditPage.setFlightNumber(trip.flightNumber);
  await hideKeyboard();
  await TripEditPage.chooseFrom(trip.from);
  await TripEditPage.chooseTo(trip.to);
  if (trip.cabin) await TripEditPage.chooseCabin(trip.cabin);
  await TripEditPage.save();
  await FlightsPage.waitForShown();
  await driver.pause(500);
}
