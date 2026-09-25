# CarpoolBoard - Prototype 3

CarpoolBoard is a mobile carpooling application designed to connect drivers who have available seats with riders who need transportation. The app uses Driver and Rider roles while allowing both types of users to participate in a shared ride board.

## Prototype 3

Prototype 3 focuses on expanding the interaction between drivers and riders and testing how ride requests should work.

### Current Features

- Driver and Rider account roles
- Email-based prototype signup and login
- Shared CarpoolBoard dashboard
- Drivers can offer rides
- Riders can request rides from specific drivers
- Riders can provide a reason for requesting a ride
- Ride requests begin as Pending
- Drivers can Accept or Deny requests
- Confirmed passengers are displayed
- Available seat counts update when riders are accepted
- Full ride status
- Drivers can cancel/rescind rides
- Riders can cancel requests
- Profile/Account information
- Improved iOS usability when creating a ride

## Spike Test

For Prototype 3, I tested a rider request approval flow.

Instead of automatically confirming a rider when they request a ride, the request begins as **Pending**. The driver can then choose to **Accept** or **Deny** the request.

If the driver accepts the request:

- The rider becomes a confirmed passenger.
- The available seat count decreases.
- The rider is removed from the list of people looking for a ride.

If the driver denies the request:

- The request is removed.
- The available seat count does not change.
- The rider remains available to request another ride.

The spike is included in the Git history with a commit labeled:

`spike: test rider request approval flow`

## Testing
Scan the QR Code or click the link to test the application.
https://expo.dev/preview/update?message=Prototype+3+user+testing&updateRuntimeVersion=1.0.0&createdAt=2026-09-24T02%3A03%3A34.384Z&slug=exp&projectId=0e5d81b8-c9ef-4e3a-873f-83c78eb6d72c&group=7e151060-1919-441a-8a51-048ecf10781d


<img width="140" height="148" alt="image" src="https://github.com/user-attachments/assets/44d01e80-db8b-40af-b56f-cf43ba956c16" />


## Current Development

CarpoolBoard currently uses local application state for its prototype account, ride, and request information. The current email login system is a prototype and is not a production authentication system.

## Future Plans

Future development will focus on:

- Persistent user authentication
- Persistent ride and request data
- Multi-user synchronization across separate devices
- Additional user testing with drivers and riders
- Notifications and asynchronous updates
- Accessibility and error handling
- Privacy and safety considerations
- Possible location or map functionality

## Implementation Plan

The complete semester development plan is available in:

`implementation plan.md`

## Built With

- React Native
- Expo
- JavaScript
- EAS
- Git/GitHub
