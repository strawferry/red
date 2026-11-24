(function () {
  'use strict';

  const duration = 8000;
  const holdTime = 300;
  const settlingTime = 900;
  const revealTime = 700;
  const seatSpinTime = 1250;
  const seatRevealTime = 550;
  const lateThreshold = 2000;
  const waveGap = 1000;
  const maxExtension = 2000;

  function displayPoint(ticket, width, height) {
    const edgeX = Math.min(0.15, 28 / Math.max(1, width));
    const edgeY = Math.min(0.18, 38 / Math.max(1, height));
    return {
      x: Math.min(1 - edgeX, Math.max(edgeX, ticket.x)),
      y: Math.min(1 - edgeY, Math.max(edgeY, ticket.y))
    };
  }

  function pickIndex(length) {
    const crypto = window.crypto;
    if (crypto && typeof crypto.getRandomValues === 'function' && length <= 4294967296) {
      const sample = new Uint32Array(1);
      const limit = Math.floor(4294967296 / length) * length;
      do {
        crypto.getRandomValues(sample);
      } while (sample[0] >= limit);
      return sample[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function createRound(selectIndex) {
    const choose = selectIndex || pickIndex;
    const contacts = new Map();
    const state = {
      phase: 'waiting',
      mode: 'touch',
      tickets: [],
      deadline: 0,
      readyAt: null,
      extended: 0,
      lastChangeAt: null,
      waveExtended: false,
      notice: null,
      spinStartedAt: 0,
      spinWinnerIndex: null,
      revealUntil: 0,
      winner: null,
      result: null,
      layout: null
    };

    function reset(mode) {
      contacts.clear();
      state.phase = 'waiting';
      state.mode = mode;
      state.tickets = [];
      state.deadline = 0;
      state.readyAt = null;
      state.extended = 0;
      state.lastChangeAt = null;
      state.waveExtended = false;
      state.notice = null;
      state.spinStartedAt = 0;
      state.spinWinnerIndex = null;
      state.revealUntil = 0;
      state.winner = null;
      state.result = null;
      state.layout = null;
    }

    function lockTickets(tickets, layout) {
      state.readyAt = null;
      state.tickets = tickets.map(function (ticket) {
        return { id: ticket.id, x: ticket.x, y: ticket.y };
      });
      state.layout = layout || null;
    }

    function reveal(winnerIndex, at, animationTime) {
      state.winner = state.tickets[winnerIndex].id;
      state.result = {
        mode: state.mode,
        winner: state.winner,
        tickets: state.tickets.slice(),
        layout: state.layout
      };
      state.revealUntil = at + animationTime;
      state.phase = 'reveal';
    }

    function registrationOpen() {
      return state.mode === 'touch' && (state.phase === 'waiting' || state.phase === 'countdown');
    }

    function startCountdown(at) {
      if (state.phase === 'waiting' && state.readyAt !== null && at >= state.readyAt) {
        state.deadline = state.readyAt + duration;
        state.readyAt = null;
        state.phase = 'countdown';
      }
    }

    function scheduleCountdown(at) {
      state.readyAt = state.tickets.length >= 2 ? at + settlingTime : null;
    }

    function returnToWaiting() {
      state.phase = 'waiting';
      state.readyAt = null;
      state.deadline = 0;
      state.extended = 0;
      state.lastChangeAt = null;
      state.waveExtended = false;
      state.notice = null;
    }

    function noteChange(kind, at) {
      if (state.lastChangeAt === null || at - state.lastChangeAt >= waveGap) state.waveExtended = false;
      state.lastChangeAt = at;
      const addTime = state.deadline - at <= lateThreshold && !state.waveExtended && state.extended < maxExtension;
      if (addTime) {
        state.deadline += 1000;
        state.extended += 1000;
        state.waveExtended = true;
      }
      const previous = state.notice && state.notice.until > at ? state.notice : null;
      state.notice = {
        kind: previous && previous.kind !== kind ? 'changed' : kind,
        extended: addTime || Boolean(previous && previous.extended),
        until: at + 1000
      };
    }

    function registerContact(contact) {
      const existing = new Set(state.tickets.map(function (ticket) { return ticket.id; }));
      let id = 1;
      while (existing.has(id)) id++;
      contact.ticket = { id: id, x: contact.x, y: contact.y };
      state.tickets.push(contact.ticket);
      if (state.phase === 'waiting') scheduleCountdown(contact.eligibleAt);
      else noteChange('joined', contact.eligibleAt);
    }

    function advance(at) {
      let changed = false;
      if (registrationOpen()) {
        for (const contact of contacts.values()) {
          if (contact.ticket || at < contact.eligibleAt) continue;
          startCountdown(contact.eligibleAt);
          if (state.phase === 'countdown' && contact.eligibleAt >= state.deadline) continue;
          registerContact(contact);
          changed = true;
        }
        startCountdown(at);
      }
      if (state.phase === 'countdown' && at >= state.deadline) {
        reveal(choose(state.tickets.length), state.deadline, revealTime);
      }
      if (state.phase === 'spinning' && at >= state.deadline) {
        reveal(state.spinWinnerIndex, state.deadline, seatRevealTime);
      }
      if (state.phase === 'reveal' && at >= state.revealUntil) {
        state.phase = 'result';
      }
      return changed;
    }

    function join(identifier, point, at) {
      if (!registrationOpen() || contacts.has(identifier)) return false;
      contacts.set(identifier, {
        identifier: identifier, x: point.x, y: point.y, eligibleAt: at + holdTime, ticket: null
      });
      return true;
    }

    function move(identifier, point) {
      const contact = contacts.get(identifier);
      if (!registrationOpen() || !contact || (contact.ticket && state.phase === 'countdown')) return false;
      contact.x = point.x;
      contact.y = point.y;
      if (contact.ticket) {
        contact.ticket.x = point.x;
        contact.ticket.y = point.y;
      }
      return true;
    }

    function release(identifier, at) {
      const contact = contacts.get(identifier);
      if (!contact) return false;
      contacts.delete(identifier);
      if (contact.ticket && registrationOpen()) {
        const index = state.tickets.indexOf(contact.ticket);
        state.tickets.splice(index, 1);
        if (state.phase === 'waiting') scheduleCountdown(at);
        else if (state.tickets.length < 2) returnToWaiting();
        else noteChange('left', at);
      }
      return true;
    }

    function pendingContacts() {
      if (!registrationOpen()) return [];
      return Array.from(contacts.values()).filter(function (contact) { return !contact.ticket; });
    }

    function clearContacts() {
      contacts.clear();
      if (registrationOpen()) {
        state.tickets = [];
        returnToWaiting();
      }
    }

    function startSeats(tickets, at, layout, skipAnimation) {
      if (state.mode !== 'seat' || state.phase !== 'waiting' || tickets.length < 2) return false;
      lockTickets(tickets, layout);
      state.spinWinnerIndex = choose(state.tickets.length);
      if (skipAnimation) {
        reveal(state.spinWinnerIndex, at, 0);
        advance(at);
      } else {
        state.spinStartedAt = at;
        state.deadline = at + seatSpinTime;
        state.phase = 'spinning';
      }
      return true;
    }

    function scanningSeat(at) {
      if (state.phase !== 'spinning') return null;
      const count = state.tickets.length;
      const steps = Math.min(14, Math.max(8, count + 2));
      const progress = Math.max(0, Math.min(1, (at - state.spinStartedAt) / seatSpinTime));
      const eased = 1 - Math.pow(1 - progress, 1.65);
      const remaining = steps - Math.min(steps - 1, Math.floor(eased * steps));
      return state.tickets[(state.spinWinnerIndex - remaining % count + count) % count].id;
    }

    return {
      state: state,
      reset: reset,
      advance: advance,
      join: join,
      move: move,
      release: release,
      clearContacts: clearContacts,
      contactCount: function () { return contacts.size; },
      pendingContacts: pendingContacts,
      scanningSeat: scanningSeat,
      startSeats: startSeats
    };
  }

  window.RaffleRound = { create: createRound, displayPoint: displayPoint };
}());
