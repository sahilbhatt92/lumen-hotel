import {
  formatMoney,
  guestName,
  requestKindLabel,
  roomStatusLabel,
  summarizeDay,
  type HotelState,
  type Reservation,
  type StaffRequest,
} from "@lumen/domain";
import { useMemo, useState, type ReactNode } from "react";

export function Today({ state }: { state: HotelState }) {
  const arrivals = state.reservations.filter(
    (reservation) => reservation.status === "confirmed" && reservation.arrival === state.businessDate,
  );
  const departures = state.reservations.filter(
    (reservation) => reservation.status === "in_house" && reservation.departure === state.businessDate,
  );
  const requests = state.staffRequests.filter((request) => request.status !== "done");
  const occupied = state.rooms.filter((room) => room.status === "occupied").length;
  const clean = state.rooms.filter((room) => room.status === "vacant" || room.status === "inspected").length;
  const dirty = state.rooms.filter((room) => room.status === "dirty").length;

  return (
    <>
      <p className="lede" data-testid="briefing">
        {summarizeDay(state)}
      </p>
      <dl className="figures">
        <div>
          <dt>Occupied</dt>
          <dd>{occupied}</dd>
        </div>
        <div>
          <dt>Clean</dt>
          <dd>{clean}</dd>
        </div>
        <div>
          <dt>Dirty</dt>
          <dd>{dirty}</dd>
        </div>
        <div>
          <dt>Arrivals</dt>
          <dd>{arrivals.length}</dd>
        </div>
      </dl>
      <div className="columns">
        <Log title="Arrivals" empty="No arrivals left today.">
          {arrivals.map((reservation) => (
            <StayLine key={reservation.id} state={state} reservation={reservation} />
          ))}
        </Log>
        <Log title="Departures" empty="No departures left today.">
          {departures.map((reservation) => (
            <StayLine key={reservation.id} state={state} reservation={reservation} />
          ))}
        </Log>
        <Log title="Open requests" empty="The house is clear.">
          {requests.map((request) => (
            <li key={request.id}>
              <strong>{request.summary}</strong>
              <p className="quiet">
                {request.id} · {requestKindLabel(request.kind)} · room {request.roomNumber ?? "—"}
              </p>
            </li>
          ))}
        </Log>
      </div>
    </>
  );
}

export function Rooms({
  state,
  fresh,
  focusId,
}: {
  state: HotelState;
  fresh: ReadonlySet<string>;
  focusId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const rooms = state.rooms.filter((room) => matches(query, room.number, room.type, room.status, room.features.join(" ")));
  const floors = [...new Set(rooms.map((room) => room.floor))];

  return (
    <>
      <Filter value={query} onChange={setQuery} placeholder="Filter by room, type, or status" />
      <div className="sheet">
        {floors.map((floor) => (
          <section className="floor" key={floor}>
            <h3>Floor {floor}</h3>
            <div className="rooms">
              {rooms
                .filter((room) => room.floor === floor)
                .map((room) => {
                  const holder = state.reservations.find(
                    (reservation) =>
                      reservation.roomNumber === room.number &&
                      (reservation.status === "in_house" || reservation.status === "confirmed"),
                  );
                  const focused = focusId === room.id;
                  const flashed = fresh.has(room.id) || fresh.has(room.number);
                  return (
                    <article
                      key={room.id}
                      id={`record-${room.id}`}
                      data-testid={`room-${room.number}`}
                      className={`room is-${room.status}${focused ? " is-focus" : ""}${flashed ? " is-fresh" : ""}`}
                    >
                      <p className="num">{room.number}</p>
                      <p className="meta">{room.type}</p>
                      <p className="status">{roomStatusLabel(room.status)}</p>
                      <p className="quiet">{holder ? `${holder.id} · ${guestName(state, holder.guestId)}` : "Open"}</p>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
        {rooms.length === 0 ? <p className="empty">Nothing on the board matches.</p> : null}
      </div>
    </>
  );
}

export function Reservations({
  state,
  fresh,
  focusId,
}: {
  state: HotelState;
  fresh: ReadonlySet<string>;
  focusId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      state.reservations.filter((reservation) =>
        matches(
          query,
          reservation.id,
          reservation.status,
          reservation.roomNumber ?? "",
          guestName(state, reservation.guestId),
          reservation.ratePlan,
        ),
      ),
    [query, state],
  );

  return (
    <>
      <Filter value={query} onChange={setQuery} placeholder="Filter by guest, stay, or room" />
      <ReservationTable state={state} rows={rows} fresh={fresh} focusId={focusId} />
    </>
  );
}

export function ReservationTable({
  state,
  rows,
  fresh,
  focusId,
}: {
  state: HotelState;
  rows: Reservation[];
  fresh: ReadonlySet<string>;
  focusId?: string | null;
}) {
  return (
    <div className="sheet">
      <table>
        <thead>
          <tr>
            <th>Stay</th>
            <th>Guest</th>
            <th>Status</th>
            <th>Room</th>
            <th>Dates</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((reservation) => (
            <tr
              key={reservation.id}
              id={`record-${reservation.id}`}
              className={`${focusId === reservation.id ? "is-focus" : ""} ${fresh.has(reservation.id) ? "is-fresh" : ""}`}
            >
              <td>{reservation.id}</td>
              <td>
                {guestName(state, reservation.guestId)}
                {reservation.notes ? <div className="note">{reservation.notes}</div> : null}
              </td>
              <td className="stay" data-testid={`status-${reservation.id}`}>
                {reservation.status.replaceAll("_", " ")}
              </td>
              <td>{reservation.roomNumber ?? "—"}</td>
              <td>
                {reservation.arrival} → {reservation.departure}
              </td>
              <td>{formatMoney(reservation.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">Nothing on the board matches.</p> : null}
    </div>
  );
}

export function Guests({ state, focusId }: { state: HotelState; focusId?: string | null }) {
  const [query, setQuery] = useState("");
  const guests = state.guests.filter((guest) => matches(query, guest.name, guest.email, guest.loyaltyTier, guest.notes));
  return (
    <>
      <Filter value={query} onChange={setQuery} placeholder="Filter by name or tier" />
      <div className="guest-list">
        {guests.map((guest) => {
          const stays = state.reservations.filter((reservation) => reservation.guestId === guest.id);
          return (
            <article key={guest.id} id={`record-${guest.id}`} className={`guest${focusId === guest.id ? " is-focus" : ""}`}>
              <header>
                <strong>{guest.name}</strong>
                <span className="tier">{guest.loyaltyTier}</span>
              </header>
              <p className="quiet">{guest.email}</p>
              <p className="quiet">{guest.notes}</p>
              <p className="quiet">
                {stays.length
                  ? stays.map((stay) => `${stay.id} · ${stay.status.replaceAll("_", " ")}`).join("  ·  ")
                  : "No stay on this board."}
              </p>
            </article>
          );
        })}
        {guests.length === 0 ? <p className="empty">Nothing on the board matches.</p> : null}
      </div>
    </>
  );
}

export function Requests({
  state,
  fresh,
  focusId,
}: {
  state: HotelState;
  fresh: ReadonlySet<string>;
  focusId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const rows = state.staffRequests.filter((request) =>
    matches(query, request.id, request.summary, request.kind, request.status, request.roomNumber ?? ""),
  );
  const groups: StaffRequest["status"][] = ["open", "in_progress", "done"];
  return (
    <>
      <Filter value={query} onChange={setQuery} placeholder="Filter requests" />
      <div className="request-groups">
        {groups.map((status) => (
          <section className="group" key={status}>
            <h3>{status.replaceAll("_", " ")}</h3>
            <ul>
              {rows
                .filter((request) => request.status === status)
                .map((request) => (
                  <li
                    key={request.id}
                    id={`record-${request.id}`}
                    className={`${focusId === request.id ? "is-focus" : ""} ${fresh.has(request.id) ? "is-fresh" : ""}`}
                  >
                    <strong>{request.summary}</strong>
                    <span className="quiet">
                      {request.id} · {requestKindLabel(request.kind)} · room {request.roomNumber ?? "—"}
                    </span>
                  </li>
                ))}
            </ul>
            {rows.some((request) => request.status === status) ? null : <p className="empty">None.</p>}
          </section>
        ))}
      </div>
    </>
  );
}

function Log({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="column">
      <h3>{title}</h3>
      {items.length ? <ul>{children}</ul> : <p className="empty">{empty}</p>}
    </section>
  );
}

function StayLine({ state, reservation }: { state: HotelState; reservation: Reservation }) {
  return (
    <li>
      <strong>{guestName(state, reservation.guestId)}</strong>
      <p className="quiet">
        {reservation.id} · room {reservation.roomNumber ?? "unassigned"} · {reservation.ratePlan}
      </p>
    </li>
  );
}

function Filter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="toolbar">
      <input
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function matches(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.join(" ").toLowerCase().includes(needle);
}
