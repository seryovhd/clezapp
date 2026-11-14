// Helper para gestión de borradores de mensajes por Ticket (Estilo WhatsApp Web / Telegram)

const DRAFT_PREFIX = "clezapp_draft_";
const DRAFT_EVENT = "clezapp_draft_change";

export const getTicketDraft = (ticketId, ticketUuid) => {
  try {
    if (ticketId && ticketId !== "undefined") {
      const draft = localStorage.getItem(`${DRAFT_PREFIX}${ticketId}`);
      if (draft !== null && draft !== undefined) return draft;
    }
    if (ticketUuid && ticketUuid !== "undefined" && ticketUuid !== ticketId) {
      const draftUuid = localStorage.getItem(`${DRAFT_PREFIX}${ticketUuid}`);
      if (draftUuid !== null && draftUuid !== undefined) return draftUuid;
    }
  } catch (e) {
    console.error("Error al leer borrador de ticket:", e);
  }
  return "";
};

export const setTicketDraft = (ticketId, text, ticketUuid) => {
  try {
    const hasText = typeof text === "string" && text.trim().length > 0;
    const sId = ticketId && ticketId !== "undefined" ? String(ticketId) : "";
    const sUuid = ticketUuid && ticketUuid !== "undefined" ? String(ticketUuid) : "";

    if (hasText) {
      if (sId) {
        localStorage.setItem(`${DRAFT_PREFIX}${sId}`, text);
      }
      if (sUuid && sUuid !== sId) {
        localStorage.setItem(`${DRAFT_PREFIX}${sUuid}`, text);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(DRAFT_EVENT, {
            detail: { ticketId: sId, ticketUuid: sUuid, text }
          })
        );
      }
    } else {
      clearTicketDraft(ticketId, ticketUuid);
    }
  } catch (e) {
    console.error("Error al guardar borrador de ticket:", e);
  }
};

export const clearTicketDraft = (ticketId, ticketUuid) => {
  try {
    const sId = ticketId && ticketId !== "undefined" ? String(ticketId) : "";
    const sUuid = ticketUuid && ticketUuid !== "undefined" ? String(ticketUuid) : "";

    if (sId) {
      localStorage.removeItem(`${DRAFT_PREFIX}${sId}`);
    }
    if (sUuid && sUuid !== sId) {
      localStorage.removeItem(`${DRAFT_PREFIX}${sUuid}`);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(DRAFT_EVENT, {
          detail: { ticketId: sId, ticketUuid: sUuid, text: "" }
        })
      );
    }
  } catch (e) {
    console.error("Error al limpiar borrador de ticket:", e);
  }
};

export const subscribeToDraftChanges = (callback) => {
  if (typeof window === "undefined" || !callback) return () => {};

  const handler = (event) => {
    if (event?.detail) {
      callback(event.detail);
    }
  };

  window.addEventListener(DRAFT_EVENT, handler);
  return () => {
    window.removeEventListener(DRAFT_EVENT, handler);
  };
};
