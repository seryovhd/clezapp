import React, { useState, useEffect, useReducer, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import moment from "moment";
import "moment/locale/es-mx";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import Tooltip from "@material-ui/core/Tooltip";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";

moment.locale("es-mx");

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    padding: theme.spacing(2),
    height: "80vh",
    overflowY: "auto",
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)",
  },
  searchField: {
    width: 280,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
    },
  },
  addButton: {
    height: 40,
    borderRadius: 8,
    fontWeight: "bold",
    textTransform: "none",
    boxShadow: "none",
  },
  calendarContainer: {
    height: "100%",
    padding: theme.spacing(1),
  },
  eventActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    marginLeft: theme.spacing(1),
  },
  eventContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: 6,
    backgroundColor: "#e3f2fd",
    color: "#0d47a1",
    fontSize: "0.9rem",
    fontWeight: 500,
    overflow: "hidden",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
}));

const defaultMessages = {
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Agendamientos",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay agendamientos en este período.",
  showMore: (total) => `+${total} más`,
};

const localizer = momentLocalizer(moment);

const schedulesReducer = (state, action) => {
  switch (action.type) {
    case "LOAD_SCHEDULES":
      const existingIds = new Set(state.map(s => s.id));
      const nuevos = action.payload.filter(s => s?.id && !existingIds.has(s.id));
      return [...state, ...nuevos];
    case "UPDATE_SCHEDULES":
      const s = action.payload;
      return state.map(item => item.id === s.id ? s : item);
    case "DELETE_SCHEDULE":
      return state.filter(s => s.id !== action.payload);
    case "RESET":
      return [];
    default:
      return state;
  }
};

const Schedules = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);

  const [state, setState] = useState({
    loading: false,
    pageNumber: 1,
    hasMore: false,
    searchParam: "",
    contactId: null,
    selectedSchedule: null,
    deletingSchedule: null,
    confirmModalOpen: false,
    scheduleModalOpen: false,
  });

  const [schedules, dispatch] = useReducer(schedulesReducer, []);

  const fetchSchedules = useCallback(async () => {
    try {
      setState(prev => ({...prev, loading: true}));
      const { data } = await api.get("/schedules/", {
        params: { searchParam: state.searchParam, pageNumber: state.pageNumber },
      });
      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setState(prev => ({ ...prev, hasMore: data.hasMore, loading: false }));
    } catch (err) {
      toastError(err);
      setState(prev => ({...prev, loading: false}));
    }
  }, [state.searchParam, state.pageNumber]);

  useEffect(() => {
    const timer = setTimeout(fetchSchedules, 500);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  useEffect(() => {
    const socket = socketManager.getSocket(user.companyId);
    const handler = data => {
      if (["create", "update"].includes(data.action)) {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: data.scheduleId });
      }
    };
    socket.on(`company${user.companyId}-schedule`, handler);
    return () => socket.off(`company${user.companyId}-schedule`, handler);
  }, [socketManager, user.companyId]);

  const updateState = (updates) => setState(prev => ({...prev, ...updates}));

  const handleSearch = (e) => {
    updateState({ searchParam: e.target.value.toLowerCase(), pageNumber: 1 });
    dispatch({ type: "RESET" });
  };

  const handleOpenScheduleModal = () => updateState({ selectedSchedule: null, scheduleModalOpen: true });

  const handleCloseScheduleModal = () => updateState({ selectedSchedule: null, scheduleModalOpen: false, contactId: null });

  const handleEditSchedule = (schedule) => updateState({ selectedSchedule: schedule, scheduleModalOpen: true });

  const handleDeleteSchedule = async (id) => {
    try {
      await api.delete(`/schedules/${id}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
      updateState({ confirmModalOpen: false, deletingSchedule: null });
    } catch (err) {
      toastError(err);
    }
  };

  const handleScroll = (e) => {
    if (!state.hasMore || state.loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      updateState(prev => ({...prev, pageNumber: prev.pageNumber + 1}));
    }
  };

  const EventComponent = ({ event }) => {
    const schedule = event.resource.schedule;
    return (
      <div className={classes.eventContent}>
        <Tooltip title={schedule.contact.name} placement="top">
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
            {schedule.contact.name}
          </span>
        </Tooltip>
        <div className={classes.eventActions}>
          <Tooltip title="Editar"><EditIcon onClick={() => handleEditSchedule(schedule)} /></Tooltip>
          <Tooltip title="Eliminar"><DeleteOutlineIcon onClick={() => updateState({ confirmModalOpen: true, deletingSchedule: schedule })} /></Tooltip>
        </div>
      </div>
    );
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={state.deletingSchedule && `${i18n.t("schedules.confirmationModal.deleteTitle")}`}
        open={state.confirmModalOpen}
        onClose={() => updateState({ confirmModalOpen: false })}
        onConfirm={() => handleDeleteSchedule(state.deletingSchedule?.id)}
      >
        {i18n.t("schedules.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <ScheduleModal
        open={state.scheduleModalOpen}
        onClose={handleCloseScheduleModal}
        reload={fetchSchedules}
        aria-labelledby="form-dialog-title"
        scheduleId={state.selectedSchedule?.id}
        contactId={state.contactId}
      />

      <MainHeader>
        <Title>{i18n.t("schedules.title")} ({schedules.length})</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            className={classes.searchField}
            placeholder={i18n.t("contacts.searchPlaceholder")}
            variant="outlined"
            size="small"
            value={state.searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color={theme.palette.mode === 'dark' ? 'disabled' : 'action'} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            className={classes.addButton}
            variant="contained"
            color="primary"
            onClick={handleOpenScheduleModal}
          >
            {i18n.t("schedules.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined" onScroll={handleScroll}>
        {state.loading && schedules.length === 0 ? (
          <Box className={classes.loadingContainer}><CircularProgress /></Box>
        ) : (
          <div className={classes.calendarContainer}>
            <Calendar
              messages={defaultMessages}
              formats={{ agendaDateFormat: "DD/MM ddd", weekdayFormat: "dddd", timeGutterFormat: "HH:mm" }}
              localizer={localizer}
              events={schedules.map(schedule => ({
                title: schedule.contact?.name || "Agendamiento",
                start: new Date(schedule.sendAt),
                end: new Date(schedule.sendAt),
                allDay: false,
                resource: { schedule },
              }))}
              components={{ event: EventComponent }}
              startAccessor="start"
              endAccessor="end"
              defaultView="month"
              views={["month", "week", "day", "agenda"]}
              culture="es-MX"
              style={{ height: "100%" }}
            />
          </div>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Schedules;