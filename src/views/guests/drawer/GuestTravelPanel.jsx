// The old GuestDrawer had a Travel & Accommodation editing section here, but
// its entire JSX (edit-travel form + read-only travel rows) was already
// commented out (dead) in App.jsx before this refactor, and the state that
// fed it (editTravel/flight/arrival/hotel/saved/saveTravel) had no other live
// consumer. Both were deleted as part of the extraction (see the refactor
// notes) rather than carried forward as more dead code. Nothing live remains
// to render here.
export default function GuestTravelPanel() {
  return null;
}
