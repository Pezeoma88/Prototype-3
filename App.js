import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

// This is the home screen for CarpoolBoard.
// Drivers can be added (with a name and seat count), riders can ask for a ride,
// and a waiting rider can be matched to a driver's open seat.
//
// Accounts/roles are local-only for this class-day change (no networking or
// Firebase): everyone signed in on this device shares the same `drivers` and
// `riders` board state, and each person's account just decides whether they
// see the Driver or Rider side of it. That split is what a real multi-device
// build (one phone signed in as a Driver, another as a Rider) would plug into
// later, once `drivers`/`riders` are backed by a real synced store instead of
// local state.
export default function App() {
  // The list of drivers that have been added so far.
  // Each driver is an object like
  // { id, name, destination, departureTime, seats, matchedRiders, pendingRequests }.
  // seats is the number of AVAILABLE seats; it only goes down when a request is accepted.
  // matchedRiders collects { id, name } for every confirmed passenger on this ride.
  // pendingRequests collects { id, riderId, name } for requests the driver hasn't answered yet.
  const [drivers, setDrivers] = useState([]);

  // Local accounts for this device: { id, name, role }. There is no backend,
  // so "signing up" just remembers a name + role for the session, and
  // "logging in" again with the same name reuses that same account. This is
  // the seam a real auth system would slot into later.
  const [accounts, setAccounts] = useState([]);

  // The id of the account currently signed in, or null when signed out.
  const [currentUserId, setCurrentUserId] = useState(null);

  // The current text typed into the sign-in form, and the role toggle.
  const [authNameInput, setAuthNameInput] = useState('');
  const [authRole, setAuthRole] = useState('driver');
  const [authError, setAuthError] = useState('');

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

  // True while a Save Driver press is being handled, so a fast double-tap
  // can't post the same ride twice before the form has a chance to close.
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false);

  // Lets us scroll back to the top (Available Rides) after saving a ride.
  const scrollViewRef = useRef(null);

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

  // The signed-in account, or null when nobody is signed in yet.
  const currentUser = accounts.find((account) => account.id === currentUserId) || null;

  // Runs when the user presses "Continue" on the sign-in screen. A name that
  // matches an existing account logs back into it (keeping its original
  // role); a new name creates a new local account with the chosen role.
  function handleSignIn() {
    const trimmedName = authNameInput.trim();
    if (trimmedName === '') {
      setAuthError('Please enter your name.');
      return;
    }

    const existingAccount = accounts.find(
      (account) => account.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingAccount) {
      setCurrentUserId(existingAccount.id);
    } else {
      const newAccount = { id: Date.now(), name: trimmedName, role: authRole };
      setAccounts([...accounts, newAccount]);
      setCurrentUserId(newAccount.id);
    }

    setAuthNameInput('');
    setAuthError('');
  }

  // Signs the current account out. The shared board (drivers/riders) is left
  // untouched so the next person to sign in still sees the same board.
  function handleSignOut() {
    setCurrentUserId(null);
    setIsAddingDriver(false);
    setIsAddingRider(false);
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
  }

  // Opens the Add Driver form, pre-filled with the signed-in driver's name.
  function handleAddDriver() {
    setNameInput(currentUser ? currentUser.name : '');
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
    setIsSubmittingDriver(false);
  }

  // Runs when the user presses "Save Driver".
  function handleSaveDriver() {
    // Guards against a fast double-tap posting the same ride twice.
    if (isSubmittingDriver) {
      return;
    }

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

    setIsSubmittingDriver(true);

    // Add the new driver to the list, keeping all the existing drivers.
    const newDriver = {
      id: Date.now(),
      driverAccountId: currentUser.id,
      name: trimmedName,
      destination: trimmedDestination,
      departureTime: trimmedDepartureTime,
      seats: seatsNumber,
      matchedRiders: [],
      pendingRequests: [],
    };
    setDrivers((current) => [...current, newDriver]);

    // Success: dismiss the keyboard, close/reset the form, and scroll back
    // up so the new ride is visible in Available Rides right away.
    Keyboard.dismiss();
    resetForm();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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

  // Cancels/rescinds an offered ride: removes it from Available Rides and
  // clears any Ride Details / Rider Matching state pointing at it. Other
  // drivers and riders are untouched. Only the driver who posted the ride
  // can rescind it, and we confirm first since this can't be undone.
  function handleCancelRide(driverId) {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver || !currentUser || driver.driverAccountId !== currentUser.id) {
      return;
    }

    Alert.alert(
      'Cancel this ride?',
      `This removes your ride to ${driver.destination} and can't be undone.`,
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () => {
            setDrivers((current) => current.filter((d) => d.id !== driverId));
            setSelectedRideDriverId(null);
            setReservingDriverId(null);
            setRequestNotice('');
          },
        },
      ],
      { cancelable: true }
    );
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

  // A confirmed rider gives up their seat: the seat re-opens on the ride
  // (so a "Full" ride stops showing as Full), and they go back to Looking
  // for a Ride so they can find another one. Only the rider themselves can
  // cancel their own seat.
  function handleCancelConfirmedSeat(driverId, riderId) {
    const driver = drivers.find((d) => d.id === driverId);
    const rider = driver && driver.matchedRiders.find((r) => r.id === riderId);
    if (!driver || !rider || !currentUser || currentUser.id !== riderId) {
      return;
    }

    Alert.alert(
      'Cancel your seat?',
      `You'll give up your confirmed seat on ${driver.name}'s ride to ${driver.destination}.`,
      [
        { text: 'Keep My Seat', style: 'cancel' },
        {
          text: 'Cancel Seat',
          style: 'destructive',
          onPress: () => {
            setDrivers((current) =>
              current.map((d) =>
                d.id === driverId
                  ? {
                      ...d,
                      seats: d.seats + 1,
                      matchedRiders: d.matchedRiders.filter((r) => r.id !== riderId),
                    }
                  : d
              )
            );
            setRiders((current) =>
              current.some((r) => r.id === riderId) ? current : [...current, { id: riderId, name: rider.name }]
            );
            setRequestNotice(`${rider.name} canceled their seat. A seat is now open.`);
          },
        },
      ],
      { cancelable: true }
    );
  }

  // Dismisses the Match Confirmed screen and returns to the normal home view.
  function handleDismissMatchConfirmation() {
    setMatchConfirmation(null);
  }

  // Opens the Need a Ride form, pre-filled with the signed-in rider's name.
  function handleNeedRide() {
    setRiderNameInput(currentUser ? currentUser.name : '');
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

    // Riders are tied to their account id, so re-saving (e.g. after already
    // joining) just closes the form instead of adding a duplicate entry.
    if (riders.some((rider) => rider.id === currentUser.id)) {
      resetRiderForm();
      return;
    }

    // Add the new rider to the list, keeping all the existing riders.
    const newRider = {
      id: currentUser.id,
      name: trimmedName,
    };
    setRiders((current) => [...current, newRider]);

    resetRiderForm();
  }

  // A waiting rider stops looking for a ride: they leave the waiting list,
  // and any pending requests they had out to drivers are withdrawn too.
  function handleLeaveWaitlist(riderId) {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider || !currentUser || currentUser.id !== riderId) {
      return;
    }

    Alert.alert(
      'Stop looking for a ride?',
      'This also cancels any pending requests you have sent.',
      [
        { text: 'Stay on the List', style: 'cancel' },
        {
          text: 'Remove Me',
          style: 'destructive',
          onPress: () => {
            setRiders((current) => current.filter((r) => r.id !== riderId));
            setDrivers((current) =>
              current.map((d) => ({
                ...d,
                pendingRequests: d.pendingRequests.filter((req) => req.riderId !== riderId),
              }))
            );
          },
        },
      ],
      { cancelable: true }
    );
  }

  // Gets a single uppercase letter to show inside an avatar circle.
  function getInitial(name) {
    return name.trim().charAt(0).toUpperCase();
  }

  const detailsDriver = drivers.find((driver) => driver.id === selectedRideDriverId) || null;
  // Only the driver who posted a ride can manage it (accept/deny, cancel).
  const isOwnerDriver =
    currentUser !== null &&
    currentUser.role === 'driver' &&
    detailsDriver !== null &&
    detailsDriver.driverAccountId === currentUser.id;
  const showActionsRow = currentUser
    ? currentUser.role === 'driver'
      ? !isAddingDriver
      : !isAddingRider
    : false;

  if (currentUser === null) {
    // Sign-in screen: local-only accounts, no networking or persistence yet.
    // Picking a name + role here is what a real login would set up; the rest
    // of the app just reads currentUser.role to decide what to show.
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.authFlexWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.authScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.authHeader}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoMarkText}>C</Text>
                </View>
                <Text style={styles.authTitle}>CarpoolBoard</Text>
                <Text style={styles.authSubtitle}>Sign in to see the shared ride board.</Text>
              </View>

              <View style={styles.authCard}>
                <Text style={styles.authLabel}>Your name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Jordan Smith"
                  placeholderTextColor="#9AA3B2"
                  value={authNameInput}
                  onChangeText={setAuthNameInput}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                <Text style={styles.authLabel}>I am a...</Text>
                <View style={styles.roleToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleToggleButton,
                      authRole === 'driver' && styles.roleToggleButtonActiveDriver,
                    ]}
                    onPress={() => setAuthRole('driver')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.roleToggleText,
                        authRole === 'driver' && styles.roleToggleTextActive,
                      ]}
                    >
                      Driver
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleToggleButton,
                      authRole === 'rider' && styles.roleToggleButtonActiveRider,
                    ]}
                    onPress={() => setAuthRole('rider')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.roleToggleText,
                        authRole === 'rider' && styles.roleToggleTextActive,
                      ]}
                    >
                      Rider
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.authHint}>
                  Already signed up? Enter the same name to log back in with your existing role.
                </Text>

                {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

                <TouchableOpacity
                  style={styles.saveDriverButton}
                  onPress={handleSignIn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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

        <View style={styles.accountRow}>
          <Text style={styles.accountText} numberOfLines={1}>
            Signed in as <Text style={styles.accountTextStrong}>{currentUser.name}</Text>
          </Text>
          <View
            style={[
              styles.roleBadge,
              currentUser.role === 'driver' ? styles.roleBadgeDriver : styles.roleBadgeRider,
            ]}
          >
            <Text style={styles.roleBadgeText}>
              {currentUser.role === 'driver' ? 'Driver' : 'Rider'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.logOutText}>Log Out</Text>
          </TouchableOpacity>
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

      <KeyboardAvoidingView
        style={styles.mainFlexWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
                  {detailsDriver.seats === 0 ? (
                    <View style={styles.fullPill}>
                      <Text style={styles.fullPillText}>Full</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmationDetailValue}>{detailsDriver.seats}</Text>
                  )}
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
                      {isOwnerDriver && (
                        <>
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
                        </>
                      )}
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
                  {detailsDriver.matchedRiders.map((rider) => {
                    const isSelf = currentUser.role === 'rider' && rider.id === currentUser.id;
                    return (
                      <View key={rider.id} style={styles.riderChip}>
                        <View style={[styles.avatar, styles.riderChipAvatar]}>
                          <Text style={styles.avatarText}>{getInitial(rider.name)}</Text>
                        </View>
                        <Text style={styles.riderChipName}>{rider.name}</Text>
                        {isSelf && (
                          <TouchableOpacity
                            style={styles.riderChipLeaveButton}
                            onPress={() => handleCancelConfirmedSeat(detailsDriver.id, rider.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.riderChipLeaveText}>Leave</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {currentUser.role === 'rider' &&
                (reservingDriverId === detailsDriver.id ? (
                  /* Rider Matching: the signed-in rider confirms their own request. */
                  <View style={styles.reservationPanel}>
                    <Text style={styles.reservationTitle}>
                      Request {detailsDriver.name}&apos;s ride
                    </Text>
                    <Text style={styles.reservationSubtitle}>
                      Send this request as {currentUser.name}. The driver will accept or deny it.
                    </Text>

                    <TouchableOpacity
                      style={styles.saveRiderButton}
                      onPress={() => handleRequestRide(detailsDriver.id, currentUser.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.buttonText}>Confirm Request</Text>
                    </TouchableOpacity>

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
                    const alreadyConfirmed = detailsDriver.matchedRiders.some(
                      (r) => r.id === currentUser.id
                    );
                    const alreadyPending = detailsDriver.pendingRequests.some(
                      (req) => req.riderId === currentUser.id
                    );

                    let reserveLabel = 'Request This Ride';
                    if (detailsDriver.seats === 0) {
                      reserveLabel = 'Full';
                    } else if (alreadyConfirmed) {
                      reserveLabel = 'Already Confirmed';
                    } else if (alreadyPending) {
                      reserveLabel = 'Request Pending';
                    }
                    const reserveDisabled =
                      detailsDriver.seats === 0 || alreadyConfirmed || alreadyPending;

                    return (
                      <TouchableOpacity
                        style={[
                          styles.saveDriverButton,
                          reserveDisabled && styles.rideCardButtonDisabled,
                        ]}
                        onPress={() => {
                          // Joins the shared waiting list automatically the first
                          // time a rider requests a ride, using their own account.
                          setRiders((current) =>
                            current.some((r) => r.id === currentUser.id)
                              ? current
                              : [...current, { id: currentUser.id, name: currentUser.name }]
                          );
                          handleStartReserve(detailsDriver.id);
                        }}
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
                ))}

              {isOwnerDriver && (
                <TouchableOpacity
                  style={styles.cancelRideButton}
                  onPress={() => handleCancelRide(detailsDriver.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelRideButtonText}>Cancel Ride</Text>
                </TouchableOpacity>
              )}
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
                  <View style={[styles.seatBadge, driver.seats === 0 && styles.seatBadgeFull]}>
                    <Text style={[styles.seatBadgeText, driver.seats === 0 && styles.seatBadgeTextFull]}>
                      {driver.seats === 0 ? 'Full' : `${driver.seats} seat${driver.seats === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                </View>

                {driver.driverAccountId === currentUser.id && (
                  <Text style={styles.yourRideTag}>Your Ride</Text>
                )}
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
            {riders.map((rider) => {
              const isSelf = currentUser.role === 'rider' && rider.id === currentUser.id;
              return (
                <View key={rider.id} style={styles.riderChip}>
                  <View style={[styles.avatar, styles.riderAvatar, styles.riderChipAvatar]}>
                    <Text style={styles.avatarText}>{getInitial(rider.name)}</Text>
                  </View>
                  <Text style={styles.riderChipName}>{rider.name}</Text>
                  {isSelf && (
                    <TouchableOpacity
                      style={styles.riderChipLeaveButton}
                      onPress={() => handleLeaveWaitlist(rider.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.riderChipLeaveText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Primary actions: side-by-side quick-action cards */}
        {showActionsRow && (
          <View style={styles.actionsRow}>
            {currentUser.role === 'driver' && !isAddingDriver && (
              <TouchableOpacity
                style={[styles.actionCard, styles.actionCardDriver]}
                onPress={handleAddDriver}
                activeOpacity={0.85}
              >
                <Text style={styles.actionCardLabel}>Offer a Ride</Text>
                <Text style={styles.actionCardHint}>Have extra seats?</Text>
              </TouchableOpacity>
            )}
            {currentUser.role === 'rider' && !isAddingRider && (
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
        {currentUser.role === 'driver' && isAddingDriver && (
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
              returnKeyType="next"
            />

            <TextInput
              style={styles.input}
              placeholder="Destination"
              placeholderTextColor="#9AA3B2"
              value={destinationInput}
              onChangeText={setDestinationInput}
              returnKeyType="next"
            />

            <TextInput
              style={styles.input}
              placeholder="Departure time (e.g. 5:30 PM)"
              placeholderTextColor="#9AA3B2"
              value={departureTimeInput}
              onChangeText={setDepartureTimeInput}
              returnKeyType="next"
            />

            {/* iOS has no Return key on a number pad, but pairing
                returnKeyType="done" with a number-pad keyboardType makes iOS
                show its own native "Done" toolbar above the keyboard, which
                fires onSubmitEditing below. That's what actually dismisses
                the keyboard on a real device, so no custom accessory bar is
                rendered here. Digits are filtered as typed so only whole
                numbers land. */}
            <TextInput
              style={styles.input}
              placeholder="Available seats"
              placeholderTextColor="#9AA3B2"
              value={seatsInput}
              onChangeText={(text) => setSeatsInput(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            {formError !== '' && <Text style={styles.errorText}>{formError}</Text>}

            <TouchableOpacity
              style={[styles.saveDriverButton, isSubmittingDriver && styles.rideCardButtonDisabled]}
              onPress={handleSaveDriver}
              disabled={isSubmittingDriver}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Save Ride</Text>
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
        {currentUser.role === 'rider' && isAddingRider && (
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
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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

  // Sign-in screen
  authFlexWrap: {
    flex: 1,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#16213E',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 14,
  },
  authSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 6,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
  },
  authLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B6472',
    marginBottom: 8,
    marginTop: 4,
  },
  authHint: {
    fontSize: 12,
    color: '#8A93A3',
    marginBottom: 16,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  roleToggleButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DADFE6',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
  },
  roleToggleButtonActiveDriver: {
    backgroundColor: '#3B6EF5',
    borderColor: '#3B6EF5',
  },
  roleToggleButtonActiveRider: {
    backgroundColor: '#F2994A',
    borderColor: '#F2994A',
  },
  roleToggleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#5B6472',
  },
  roleToggleTextActive: {
    color: '#fff',
  },

  // Signed-in account row (header)
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  accountText: {
    flex: 1,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  accountTextStrong: {
    color: '#fff',
    fontWeight: '700',
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 10,
  },
  roleBadgeDriver: {
    backgroundColor: 'rgba(59, 110, 245, 0.35)',
  },
  roleBadgeRider: {
    backgroundColor: 'rgba(242, 153, 74, 0.35)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  logOutText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fff',
  },

  // Wraps the scrollable page area so the keyboard can push content (and the
  // Save/Post Ride button) up instead of covering it.
  mainFlexWrap: {
    flex: 1,
  },

  // Full-ride indicators
  seatBadgeFull: {
    backgroundColor: '#FDECEC',
  },
  seatBadgeTextFull: {
    color: '#D64545',
  },
  fullPill: {
    backgroundColor: '#FDECEC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  fullPillText: {
    color: '#D64545',
    fontSize: 13,
    fontWeight: '700',
  },
  yourRideTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B6EF5',
    marginBottom: 2,
  },

  // Self-service "Leave" / "Remove" buttons on a rider's own chip
  riderChipLeaveButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FDECEC',
  },
  riderChipLeaveText: {
    color: '#D64545',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
