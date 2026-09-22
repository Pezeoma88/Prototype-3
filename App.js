import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// This is the home screen for CarpoolBoard.
// Drivers can be added (with a name and seat count), riders can ask for a ride,
// and a waiting rider can be matched to a driver's open seat.
export default function App() {
  // The list of drivers that have been added so far.
  // Each driver is an object like
  // { id, name, destination, departureTime, seats, matchedRiders, pendingRequests }.
  // seats is the number of AVAILABLE seats; it only goes down when a request is accepted.
  // matchedRiders collects { id, name } for every confirmed passenger on this ride.
  // pendingRequests collects { id, riderId, name } for requests the driver hasn't answered yet.
  const [drivers, setDrivers] = useState([]);

  // Spike: a short message about the last request action (or why one was blocked).
  const [requestNotice, setRequestNotice] = useState('');

  // Whether the "Add Driver" form is currently showing.
  const [isAddingDriver, setIsAddingDriver] = useState(false);

  // The current text typed into the form's inputs.
  const [nameInput, setNameInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [departureTimeInput, setDepartureTimeInput] = useState('');
  const [seatsInput, setSeatsInput] = useState('');

  // A validation message to show under the form, if something is wrong.
  const [formError, setFormError] = useState('');

  // The list of riders who need a ride so far.
  // Each rider is an object like { id, name }.
  const [riders, setRiders] = useState([]);

  // Whether the "Need a Ride" form is currently showing.
  const [isAddingRider, setIsAddingRider] = useState(false);

  // The current text typed into the rider name input.
  const [riderNameInput, setRiderNameInput] = useState('');

  // A validation message to show under the rider form, if something is wrong.
  const [riderFormError, setRiderFormError] = useState('');

  // The id of the driver currently picking a waiting rider to match with, or null if none.
  const [reservingDriverId, setReservingDriverId] = useState(null);

  // Details of the most recently confirmed match, or null when no confirmation is showing.
  // Shape: { riderName, driverName, destination, departureTime }.
  const [matchConfirmation, setMatchConfirmation] = useState(null);

  // The id of the driver whose Ride Details screen is currently open, or null if none.
  const [selectedRideDriverId, setSelectedRideDriverId] = useState(null);

  // Opens the Add Driver form.
  function handleAddDriver() {
    setIsAddingDriver(true);
  }

  // Closes the form and clears out anything the user typed.
  function resetForm() {
    setIsAddingDriver(false);
    setNameInput('');
    setDestinationInput('');
    setDepartureTimeInput('');
    setSeatsInput('');
    setFormError('');
  }

  // Runs when the user presses "Save Driver".
  function handleSaveDriver() {
    const trimmedName = nameInput.trim();
    const trimmedDestination = destinationInput.trim();
    const trimmedDepartureTime = departureTimeInput.trim();
    const seatsNumber = Number(seatsInput.trim());

    // Validation: name, destination, and departure time can't be empty,
    // and seats must be a whole number of 1 or more.
    if (trimmedName === '') {
      setFormError('Please enter a name.');
      return;
    }
    if (trimmedDestination === '') {
      setFormError('Please enter a destination.');
      return;
    }
    if (trimmedDepartureTime === '') {
      setFormError('Please enter a departure time.');
      return;
    }
    if (!Number.isInteger(seatsNumber) || seatsNumber < 1) {
      setFormError('Please enter a valid number of seats (1 or more).');
      return;
    }

    // Add the new driver to the list, keeping all the existing drivers.
    const newDriver = {
      id: Date.now(),
      name: trimmedName,
      destination: trimmedDestination,
      departureTime: trimmedDepartureTime,
      seats: seatsNumber,
      matchedRiders: [],
      pendingRequests: [],
    };
    setDrivers([...drivers, newDriver]);

    resetForm();
  }

  // Opens the Ride Details screen for a driver. This is the Available Rides -> Ride Details step.
  function handleViewRideDetails(driverId) {
    setSelectedRideDriverId(driverId);
    setRequestNotice('');
  }

  // Closes the Ride Details screen (and any in-progress matching) and returns to Available Rides.
  function handleBackToAvailableRides() {
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
  }

  // Cancels an offered ride: removes it from Available Rides and clears any
  // Ride Details / Rider Matching state pointing at it. Other drivers and
  // riders are untouched.
  function handleCancelRide(driverId) {
    setDrivers(drivers.filter((driver) => driver.id !== driverId));
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
  }

  // Opens (or closes, if already open) the waiting-rider picker for a driver.
  // This is the Ride Details -> Rider Matching step.
  function handleStartReserve(driverId) {
    setReservingDriverId((currentId) => (currentId === driverId ? null : driverId));
  }

  // Closes the waiting-rider picker without matching anyone.
  function handleCancelReserve() {
    setReservingDriverId(null);
  }

  // SPIKE, step 1: a waiting rider requests this specific ride.
  // The request is stored on the driver as Pending. Seats do NOT change yet,
  // and the rider stays in the waiting list (they could still request other rides).
  function handleRequestRide(driverId, riderId) {
    const driver = drivers.find((d) => d.id === driverId);
    const rider = riders.find((r) => r.id === riderId);
    if (!driver || !rider) {
      return;
    }

    if (driver.seats < 1) {
      setRequestNotice('This ride is full, so it is not accepting requests.');
      return;
    }
    if (driver.matchedRiders.some((r) => r.id === riderId)) {
      setRequestNotice(`${rider.name} is already a confirmed passenger on this ride.`);
      return;
    }
    if (driver.pendingRequests.some((req) => req.riderId === riderId)) {
      setRequestNotice(`${rider.name} already has a pending request for this ride.`);
      return;
    }

    const newRequest = { id: Date.now(), riderId: rider.id, name: rider.name };
    setDrivers(
      drivers.map((d) =>
        d.id === driverId ? { ...d, pendingRequests: [...d.pendingRequests, newRequest] } : d
      )
    );
    setReservingDriverId(null);
    setRequestNotice(`${rider.name}'s request is now Pending.`);
  }

  // SPIKE, step 2a: the driver accepts a pending request.
  // The rider becomes a confirmed passenger, available seats go down by 1,
  // and the rider leaves the waiting list (their requests to other rides are dropped).
  function handleAcceptRequest(driverId, requestId) {
    const driver = drivers.find((d) => d.id === driverId);
    const request = driver && driver.pendingRequests.find((req) => req.id === requestId);
    if (!driver || !request) {
      return;
    }

    // Edge case: the ride filled up while this request was waiting.
    if (driver.seats < 1) {
      setRequestNotice('This ride is full. Deny the request or free up a seat first.');
      return;
    }

    setDrivers(
      drivers.map((d) => {
        if (d.id === driverId) {
          return {
            ...d,
            seats: d.seats - 1,
            matchedRiders: [...d.matchedRiders, { id: request.riderId, name: request.name }],
            pendingRequests: d.pendingRequests.filter((req) => req.id !== requestId),
          };
        }
        return {
          ...d,
          pendingRequests: d.pendingRequests.filter((req) => req.riderId !== request.riderId),
        };
      })
    );
    setRiders(riders.filter((rider) => rider.id !== request.riderId));
    setRequestNotice(`${request.name} accepted: now a confirmed passenger.`);
  }

  // SPIKE, step 2b: the driver denies a pending request.
  // The request is removed; seats and confirmed passengers are unchanged.
  function handleDenyRequest(driverId, requestId) {
    const driver = drivers.find((d) => d.id === driverId);
    const request = driver && driver.pendingRequests.find((req) => req.id === requestId);
    if (!driver || !request) {
      return;
    }

    setDrivers(
      drivers.map((d) =>
        d.id === driverId
          ? { ...d, pendingRequests: d.pendingRequests.filter((req) => req.id !== requestId) }
          : d
      )
    );
    setRequestNotice(`${request.name}'s request was denied. Seats unchanged.`);
  }

  // Dismisses the Match Confirmed screen and returns to the normal home view.
  function handleDismissMatchConfirmation() {
    setMatchConfirmation(null);
  }

  // Opens the Need a Ride form.
  function handleNeedRide() {
    setIsAddingRider(true);
  }

  // Closes the rider form and clears out anything the user typed.
  function resetRiderForm() {
    setIsAddingRider(false);
    setRiderNameInput('');
    setRiderFormError('');
  }

  // Runs when the user presses "Save Rider".
  function handleSaveRider() {
    const trimmedName = riderNameInput.trim();

    // Validation: the name can't be empty.
    if (trimmedName === '') {
      setRiderFormError('Please enter a name.');
      return;
    }

    // Add the new rider to the list, keeping all the existing riders.
    const newRider = {
      id: Date.now(),
      name: trimmedName,
    };
    setRiders([...riders, newRider]);

    resetRiderForm();
  }

  // Gets a single uppercase letter to show inside an avatar circle.
  function getInitial(name) {
    return name.trim().charAt(0).toUpperCase();
  }

  const detailsDriver = drivers.find((driver) => driver.id === selectedRideDriverId) || null;
  const showActionsRow = !isAddingDriver || !isAddingRider;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Dark navy header: text + shape based branding, no emoji */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>C</Text>
          </View>
          <View style={styles.brandTextGroup}>
            <Text style={styles.brandTitle}>CarpoolBoard</Text>
            <Text style={styles.brandTagline}>Share the ride. Split the drive.</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipNumber}>{drivers.length}</Text>
            <Text style={styles.statChipLabel}>Drivers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statChip}>
            <Text style={styles.statChipNumber}>{riders.length}</Text>
            <Text style={styles.statChipLabel}>Riders Waiting</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.container}>
        {matchConfirmation ? (
          /* Match Confirmed screen: shown after a rider is matched to a driver */
          <View style={styles.confirmationWrap}>
            <View style={styles.confirmationCard}>
              <View style={styles.confirmationIconCircle}>
                <Text style={styles.confirmationIcon}>✓</Text>
              </View>

              <Text style={styles.confirmationTitle}>Ride Matched!</Text>
              <Text style={styles.confirmationSubtitle}>
                {matchConfirmation.riderName} has been matched with {matchConfirmation.driverName}
                &apos;s ride.
              </Text>

              <View style={styles.confirmationDetailsBox}>
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Rider</Text>
                  <Text style={styles.confirmationDetailValue}>
                    {matchConfirmation.riderName}
                  </Text>
                </View>
                <View style={styles.confirmationDetailDivider} />
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Driver</Text>
                  <Text style={styles.confirmationDetailValue}>
                    {matchConfirmation.driverName}
                  </Text>
                </View>
                <View style={styles.confirmationDetailDivider} />
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Destination</Text>
                  <Text style={styles.confirmationDetailValue}>
                    {matchConfirmation.destination}
                  </Text>
                </View>
                <View style={styles.confirmationDetailDivider} />
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Departs</Text>
                  <Text style={styles.confirmationDetailValue}>
                    {matchConfirmation.departureTime}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveDriverButton, styles.confirmationDoneButton]}
                onPress={handleDismissMatchConfirmation}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Back to Rides</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : detailsDriver !== null ? (
          /* Ride Details screen: shown after selecting a ride from Available Rides */
          <View style={styles.detailsWrap}>
            <View style={styles.detailsCard}>
              <TouchableOpacity
                style={styles.detailsBackRow}
                onPress={handleBackToAvailableRides}
                activeOpacity={0.7}
              >
                <Text style={styles.detailsBackArrow}>‹</Text>
                <Text style={styles.detailsBackText}>Available Rides</Text>
              </TouchableOpacity>

              <View style={styles.detailsHeaderRow}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(detailsDriver.name)}</Text>
                  </View>
                </View>
                <View style={styles.detailsHeaderText}>
                  <Text style={styles.detailsDriverName}>{detailsDriver.name}</Text>
                  <Text style={styles.detailsHeaderHint}>Ride Details</Text>
                </View>
              </View>

              <View style={styles.confirmationDetailsBox}>
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Destination</Text>
                  <Text style={styles.confirmationDetailValue}>{detailsDriver.destination}</Text>
                </View>
                <View style={styles.confirmationDetailDivider} />
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Departs</Text>
                  <Text style={styles.confirmationDetailValue}>{detailsDriver.departureTime}</Text>
                </View>
                <View style={styles.confirmationDetailDivider} />
                <View style={styles.confirmationDetailRow}>
                  <Text style={styles.confirmationDetailLabel}>Available Seats</Text>
                  <Text style={styles.confirmationDetailValue}>{detailsDriver.seats}</Text>
                </View>
              </View>

              {requestNotice !== '' && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>{requestNotice}</Text>
                </View>
              )}

              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionAccent, styles.sectionAccentRider]} />
                <Text style={styles.sectionTitle}>
                  Pending requests ({detailsDriver.pendingRequests.length})
                </Text>
              </View>

              {detailsDriver.pendingRequests.length === 0 ? (
                <Text style={styles.detailsMatchedEmpty}>No pending requests.</Text>
              ) : (
                <View style={styles.pendingList}>
                  {detailsDriver.pendingRequests.map((request) => (
                    <View key={request.id} style={styles.pendingRow}>
                      <View style={[styles.avatar, styles.riderAvatar, styles.riderPickAvatar]}>
                        <Text style={styles.avatarText}>{getInitial(request.name)}</Text>
                      </View>
                      <View style={styles.pendingInfo}>
                        <Text style={styles.riderPickName}>{request.name}</Text>
                        <Text style={styles.pendingStatus}>Pending</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.acceptButton,
                          detailsDriver.seats === 0 && styles.rideCardButtonDisabled,
                        ]}
                        onPress={() => handleAcceptRequest(detailsDriver.id, request.id)}
                        disabled={detailsDriver.seats === 0}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.acceptButtonText,
                            detailsDriver.seats === 0 && styles.rideCardButtonTextDisabled,
                          ]}
                        >
                          {detailsDriver.seats === 0 ? 'Full' : 'Accept'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.denyButton}
                        onPress={() => handleDenyRequest(detailsDriver.id, request.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.denyButtonText}>Deny</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionAccent, styles.sectionAccentDriver]} />
                <Text style={styles.sectionTitle}>
                  Confirmed passengers ({detailsDriver.matchedRiders.length})
                </Text>
              </View>

              {detailsDriver.matchedRiders.length === 0 ? (
                <Text style={styles.detailsMatchedEmpty}>No confirmed passengers yet.</Text>
              ) : (
                <View style={styles.riderChipRow}>
                  {detailsDriver.matchedRiders.map((rider) => (
                    <View key={rider.id} style={styles.riderChip}>
                      <View style={[styles.avatar, styles.riderChipAvatar]}>
                        <Text style={styles.avatarText}>{getInitial(rider.name)}</Text>
                      </View>
                      <Text style={styles.riderChipName}>{rider.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {reservingDriverId === detailsDriver.id ? (
                /* Rider Matching: choose which waiting rider fills the open seat */
                <View style={styles.reservationPanel}>
                  <Text style={styles.reservationTitle}>
                    Request {detailsDriver.name}&apos;s ride
                  </Text>
                  <Text style={styles.reservationSubtitle}>
                    Tap a waiting rider to send a request. The driver will accept or deny it.
                  </Text>

                  {riders.length === 0 ? (
                    <Text style={styles.emptyMessage}>No riders waiting.</Text>
                  ) : (
                    riders.map((rider) => (
                      <TouchableOpacity
                        key={rider.id}
                        style={styles.riderPickRow}
                        onPress={() => handleRequestRide(detailsDriver.id, rider.id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.avatar, styles.riderAvatar, styles.riderPickAvatar]}>
                          <Text style={styles.avatarText}>{getInitial(rider.name)}</Text>
                        </View>
                        <Text style={styles.riderPickName}>{rider.name}</Text>
                        {detailsDriver.pendingRequests.some((req) => req.riderId === rider.id) ? (
                          <Text style={styles.pendingStatus}>Pending</Text>
                        ) : (
                          <Text style={styles.riderPickArrow}>›</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelReserve}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                (() => {
                  let reserveLabel = 'Request This Ride';
                  if (detailsDriver.seats === 0) {
                    reserveLabel = 'Full';
                  } else if (riders.length === 0) {
                    reserveLabel = 'No Riders';
                  }
                  const reserveDisabled = detailsDriver.seats === 0 || riders.length === 0;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.saveDriverButton,
                        reserveDisabled && styles.rideCardButtonDisabled,
                      ]}
                      onPress={() => handleStartReserve(detailsDriver.id)}
                      disabled={reserveDisabled}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          reserveDisabled && styles.rideCardButtonTextDisabled,
                        ]}
                      >
                        {reserveLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })()
              )}

              <TouchableOpacity
                style={styles.cancelRideButton}
                onPress={() => handleCancelRide(detailsDriver.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelRideButtonText}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
        <>
        {/* Available Rides section (drivers) */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionAccent, styles.sectionAccentDriver]} />
          <Text style={styles.sectionTitle}>Available Rides</Text>
        </View>

        {drivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyMessage}>No drivers yet.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rideCarousel}
          >
            {drivers.map((driver) => (
              <TouchableOpacity
                key={driver.id}
                style={styles.rideCard}
                onPress={() => handleViewRideDetails(driver.id)}
                activeOpacity={0.85}
              >
                <View style={styles.rideCardTop}>
                  <View style={styles.avatarRing}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitial(driver.name)}</Text>
                    </View>
                  </View>
                  <View style={styles.seatBadge}>
                    <Text style={styles.seatBadgeText}>
                      {driver.seats} seat{driver.seats === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.rideCardName}>{driver.name}</Text>

                <View style={styles.rideCardRouteRow}>
                  <Text style={styles.rideCardRouteIcon}>→</Text>
                  <Text style={styles.rideCardDestination} numberOfLines={1}>
                    {driver.destination}
                  </Text>
                </View>

                <View style={styles.rideCardTimeBadge}>
                  <Text style={styles.rideCardTimeText}>Departs {driver.departureTime}</Text>
                </View>

                <Text style={styles.rideCardCounts}>
                  {driver.pendingRequests.length} pending · {driver.matchedRiders.length} confirmed
                </Text>

                <View style={styles.rideCardButton}>
                  <Text style={styles.rideCardButtonText}>View Details</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Looking for a Ride section (riders) */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionAccent, styles.sectionAccentRider]} />
          <Text style={styles.sectionTitle}>Looking for a Ride</Text>
        </View>

        {riders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyMessage}>No riders waiting.</Text>
          </View>
        ) : (
          <View style={styles.riderChipRow}>
            {riders.map((rider) => (
              <View key={rider.id} style={styles.riderChip}>
                <View style={[styles.avatar, styles.riderAvatar, styles.riderChipAvatar]}>
                  <Text style={styles.avatarText}>{getInitial(rider.name)}</Text>
                </View>
                <Text style={styles.riderChipName}>{rider.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Primary actions: side-by-side quick-action cards */}
        {showActionsRow && (
          <View style={styles.actionsRow}>
            {!isAddingDriver && (
              <TouchableOpacity
                style={[styles.actionCard, styles.actionCardDriver]}
                onPress={handleAddDriver}
                activeOpacity={0.85}
              >
                <Text style={styles.actionCardLabel}>Offer a Ride</Text>
                <Text style={styles.actionCardHint}>Have extra seats?</Text>
              </TouchableOpacity>
            )}
            {!isAddingRider && (
              <TouchableOpacity
                style={[styles.actionCard, styles.actionCardRider]}
                onPress={handleNeedRide}
                activeOpacity={0.85}
              >
                <Text style={styles.actionCardLabel}>Request a Ride</Text>
                <Text style={styles.actionCardHint}>Need a lift?</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Add Driver form */}
        {isAddingDriver && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccent, styles.sectionAccentDriver]} />
              <Text style={styles.sectionTitle}>Offer a Ride</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Driver name"
              placeholderTextColor="#9AA3B2"
              value={nameInput}
              onChangeText={setNameInput}
            />

            <TextInput
              style={styles.input}
              placeholder="Destination"
              placeholderTextColor="#9AA3B2"
              value={destinationInput}
              onChangeText={setDestinationInput}
            />

            <TextInput
              style={styles.input}
              placeholder="Departure time (e.g. 5:30 PM)"
              placeholderTextColor="#9AA3B2"
              value={departureTimeInput}
              onChangeText={setDepartureTimeInput}
            />

            <TextInput
              style={styles.input}
              placeholder="Available seats"
              placeholderTextColor="#9AA3B2"
              value={seatsInput}
              onChangeText={setSeatsInput}
              keyboardType="numeric"
            />

            {formError !== '' && <Text style={styles.errorText}>{formError}</Text>}

            <TouchableOpacity
              style={styles.saveDriverButton}
              onPress={handleSaveDriver}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Save Driver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetForm}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Request a Ride form */}
        {isAddingRider && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionAccent, styles.sectionAccentRider]} />
              <Text style={styles.sectionTitle}>Request a Ride</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#9AA3B2"
              value={riderNameInput}
              onChangeText={setRiderNameInput}
            />

            {riderFormError !== '' && (
              <Text style={styles.errorText}>{riderFormError}</Text>
            )}

            <TouchableOpacity
              style={styles.saveRiderButton}
              onPress={handleSaveRider}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Save Rider</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetRiderForm}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#16213E',
  },

  // Dark navy header: brand row + inline stat chips
  header: {
    backgroundColor: '#16213E',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoMarkText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16213E',
  },
  brandTextGroup: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  brandTagline: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
  },
  statChipNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  statChipLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // Scrollable page area
  scrollArea: {
    flex: 1,
    backgroundColor: '#F3F5F8',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },

  // Match Confirmed screen
  confirmationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  confirmationCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF1F6',
    shadowColor: '#16213E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  confirmationIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B6EF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmationIcon: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16213E',
    marginBottom: 6,
  },
  confirmationSubtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationDetailsBox: {
    width: '100%',
    backgroundColor: '#F7F9FC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  confirmationDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmationDetailLabel: {
    fontSize: 13,
    color: '#8A93A3',
    fontWeight: '600',
  },
  confirmationDetailValue: {
    fontSize: 14,
    color: '#1A2333',
    fontWeight: '700',
  },
  confirmationDetailDivider: {
    height: 1,
    backgroundColor: '#E8EBF0',
  },
  confirmationDoneButton: {
    alignSelf: 'stretch',
    marginBottom: 0,
  },

  // Ride Details screen
  detailsWrap: {
    flex: 1,
    paddingTop: 4,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    shadowColor: '#16213E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  detailsBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  detailsBackArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B6EF5',
    marginRight: 2,
  },
  detailsBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B6EF5',
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  detailsHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  detailsDriverName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#16213E',
  },
  detailsHeaderHint: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#8A93A3',
    marginTop: 2,
  },
  detailsMatchedEmpty: {
    fontSize: 14,
    color: '#8A93A3',
    marginBottom: 18,
  },
  cancelRideButton: {
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelRideButtonText: {
    color: '#D64545',
    fontSize: 15,
    fontWeight: '700',
  },

  // Section headers (shared by Available Rides / Looking for a Ride / forms)
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionAccentDriver: {
    backgroundColor: '#3B6EF5',
  },
  sectionAccentRider: {
    backgroundColor: '#F2994A',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#16213E',
    letterSpacing: 0.1,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#8A93A3',
  },

  // Available Rides horizontal carousel
  rideCarousel: {
    paddingRight: 4,
    paddingBottom: 4,
    marginBottom: 20,
  },
  rideCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    shadowColor: '#16213E',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rideCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rideCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2333',
  },
  rideCardRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rideCardRouteIcon: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B6EF5',
    marginRight: 5,
  },
  rideCardDestination: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#3A4256',
  },
  rideCardTimeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F5F8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  rideCardCounts: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A93A3',
    marginBottom: 12,
  },

  // Spike: request notice, pending request rows, accept / deny buttons
  noticeBox: {
    backgroundColor: '#EEF3FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E2FE',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#16213E',
  },
  pendingList: {
    marginBottom: 18,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F7E3D1',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F2994A',
  },
  acceptButton: {
    backgroundColor: '#3B6EF5',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  denyButton: {
    backgroundColor: '#FDECEC',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 6,
  },
  denyButtonText: {
    color: '#D64545',
    fontSize: 13,
    fontWeight: '700',
  },
  rideCardTimeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#5B6472',
  },
  rideCardButton: {
    backgroundColor: '#3B6EF5',
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rideCardButtonDisabled: {
    backgroundColor: '#E5E8EE',
  },
  rideCardButtonText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  rideCardButtonTextDisabled: {
    color: '#9AA3B2',
  },

  // Reservation panel: pick a waiting rider to match with a driver
  reservationPanel: {
    backgroundColor: '#EEF3FF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D6E2FE',
  },
  reservationTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#16213E',
  },
  reservationSubtitle: {
    fontSize: 12.5,
    color: '#5B6B8C',
    marginTop: 3,
    marginBottom: 14,
  },
  riderPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E4EBFC',
  },
  riderPickAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  riderPickName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1A2333',
  },
  riderPickArrow: {
    fontSize: 18,
    color: '#9AA3B2',
  },

  // Driver / rider avatars (shared)
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EFFE',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3B6EF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatar: {
    backgroundColor: '#F2994A',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  seatBadge: {
    backgroundColor: '#E8EFFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seatBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B6EF5',
  },

  // Looking for a Ride: wrapping chip row
  riderChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  riderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F7E3D1',
  },
  riderChipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  riderChipName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2333',
  },

  // Primary actions: side-by-side quick-action cards
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    borderBottomWidth: 3,
    shadowColor: '#16213E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  actionCardDriver: {
    borderBottomColor: '#3B6EF5',
  },
  actionCardRider: {
    borderBottomColor: '#F2994A',
  },
  actionCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16213E',
  },
  actionCardHint: {
    fontSize: 12,
    color: '#8A93A3',
    marginTop: 3,
  },

  // Section containers (forms)
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    shadowColor: '#16213E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  // Form inputs
  input: {
    borderWidth: 1,
    borderColor: '#DADFE6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#FAFBFC',
  },
  errorText: {
    color: '#D64545',
    fontSize: 14,
    marginBottom: 12,
  },

  saveDriverButton: {
    backgroundColor: '#3B6EF5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  saveRiderButton: {
    backgroundColor: '#F2994A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#EDEFF2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
});
