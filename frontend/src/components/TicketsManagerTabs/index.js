import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Add as AddIcon,
  PlaylistAddCheckOutlined as PlaylistAddCheckOutlinedIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  DoneAll as DoneAllIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Search as SearchIcon,
  Phone as PhoneIcon
} from "@material-ui/icons";
import {
  makeStyles,
  Paper,
  Tabs,
  Tab,
  Badge,
  Snackbar,
  IconButton,
  Button,
  Tooltip,
  Box,
  useTheme,
  TextField,
  InputAdornment,
} from "@material-ui/core";

import toastError from '../../errors/toastError';
import api from '../../services/api';
import NewTicketModal from '../NewTicketModal';
import TicketsList from '../TicketsListCustom';
import TicketsListGroup from '../TicketsListGroup';
import TabPanel from '../TabPanel';
import { i18n } from '../../translate/i18n';
import { AuthContext } from '../../context/Auth/AuthContext';
import { Can } from '../Can';
import { TagsFilter } from '../TagsFilter';
import { UsersFilter } from '../UsersFilter';
const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: 'relative',
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
    overflowX: 'hidden',
  },
  tabsHeader: {
    flex: 'none',
    height: 73,
    backgroundColor: theme.palette.tabHeaderBackground,
    paddingTop: "10px"
  },
  tab: {
    minWidth: 60,
    width: 60,
  },
  ticketOptionsBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.ticketoptions,
    padding: theme.spacing(1),
  },
  addButtonStyled: {
    background: theme.palette.type === 'dark' ? '#00a884' : '#008069',
    color: '#ffffff',
    borderRadius: 12,
    padding: 8,
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.2)",
    transition: "background 0.2s, transform 0.2s",
    "&:hover": {
      background: theme.palette.type === 'dark' ? '#029070' : '#00a884',
      transform: "scale(1.05)",
    },
  },
  rightActions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginLeft: 'auto'
  },
  snackbar: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    borderRadius: 30,
  },
  yesButton: {
    backgroundColor: "#FFF",
    color: "rgba(0, 100, 0, 1)",
    padding: "4px 8px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "darkGreen",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  noButton: {
    backgroundColor: "#FFF",
    color: "rgba(139, 0, 0, 1)",
    padding: "4px 8px",
    fontSize: "1em",
    fontWeight: "bold",
    textTransform: "uppercase",
    "&:hover": {
      backgroundColor: "darkRed",
      color: "#FFF",
    },
    borderRadius: 30,
  },
  groupTicketsWrapper: {
    position: 'relative',
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
    borderTop: `2px solid ${theme.palette.primary.main}`,
  },
  pendingBadge: {
    backgroundColor: "#d32f2f",
    color: "#ffffff",
  },
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();

  const [tab, setTab] = useState('open');
  const [tabOpen, setTabOpen] = useState('open');
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const { user } = useContext(AuthContext);

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = user.queues?.map((q) => q.id) || [];
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [closedBox, setClosedBox] = useState(false);
  const [groupBox, setGroupBox] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  
  // DEBUG: Agregar logs para verificar
  // useEffect(() => {
  //  console.log('=== DEBUG TICKETS MANAGER ===');
  //  console.log('User profile:', user.profile);
  //  console.log('ShowAllTickets state:', showAllTickets);
  //  console.log('ShowAllTickets type:', typeof showAllTickets);
  //  console.log('Selected queue IDs:', selectedQueueIds);
  //  console.log('Current tab:', tab);
  //  console.log('Current tabOpen:', tabOpen);
  // }, [user.profile, showAllTickets, selectedQueueIds, tab, tabOpen]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await api.get('/settings/');
        const setting = data.find(s => s.key === 'viewclosed');
        if (setting?.value === 'enabled' || user.profile === 'admin') {
          setClosedBox(true);
        } else {
          setClosedBox(false);
        }
        const waitTimeSetting = data.find(s => s.key === 'showTicketWaitTime');
        if (waitTimeSetting) {
          localStorage.setItem("showTicketWaitTime", waitTimeSetting.value);
        }
        const hideConn = data.find(s => s.key === 'hideConnectionTag');
        if (hideConn) {
          localStorage.setItem("hideConnectionTag", hideConn.value);
        }
        const hideAgent = data.find(s => s.key === 'hideAgentTag');
        if (hideAgent) {
          localStorage.setItem("hideAgentTag", hideAgent.value);
        }
        const hideTags = data.find(s => s.key === 'hideTicketTags');
        if (hideTags) {
          localStorage.setItem("hideTicketTags", hideTags.value);
        }
        window.dispatchEvent(new Event("settings-update"));
      } catch (err) {
        toastError(err);
      }
    }
    fetchData();
  }, [user.profile]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await api.get("/settings/");
        const checkGroup = data.find((s) => s.key === "CheckMsgIsGroup");
        if (checkGroup?.value !== "enabled") {
          setGroupBox(true);
        } else {
          setGroupBox(false);
        }
      } catch (err) {
        toastError(err);
        setGroupBox(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (tab !== 'search') {
      setSearchPhone('');
    }
  }, [tab]);
  useEffect(() => {
    if (user?.queues?.length > 0) {
      setSelectedQueueIds(user.queues.map((q) => q.id));
    }
  }, [user]);

  useEffect(() => {
    // Por defecto, todos los usuarios ven solo sus tickets
    // El admin puede cambiar esto con el botón
    setShowAllTickets(false);
  }, [user.profile]);

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const CloseAllTicket = async () => {
    try {
      await api.post("/tickets/closeAll", {
        status: tabOpen,
        selectedQueueIds,
      });
      setSnackbarOpen(false);
    } catch (err) {
      console.log("Error: ", err);
      toastError(err);
    }
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { display: "none" };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket?.uuid) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  const handleSearchPhoneChange = (e) => {
    setSearchPhone(e.target.value);
  };

  // SOLUCIÓN: Determinar showAll basado en perfil y estado
  const getShowAllValue = () => {
    // Solo admin puede ver todos los tickets, otros usuarios solo ven los suyos
    return user?.profile?.toUpperCase() === 'ADMIN' ? showAllTickets : false;
  };

  return (
    <Paper elevation={0} variant='outlined' className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={handleCloseOrOpenTicket}
      />

      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant='fullWidth'
          indicatorColor='primary'
          textColor='primary'
        >
          <Tab value={'open'} icon={<ChatIcon />} classes={{ root: classes.tab }} />
          {groupBox && (
            <Tab value={'group'} icon={<GroupIcon />} classes={{ root: classes.tab }} />
          )}
          {closedBox && (
            <Tab value={'closed'} icon={<DoneAllIcon />} classes={{ root: classes.tab }} />
          )}
          <Tab value={'search'} icon={<SearchIcon />} classes={{ root: classes.tab }} />
        </Tabs>
      </Paper>

      {tab !== "group" && tab !== "closed" && tab !== "search" && (
        <Paper square elevation={0} className={classes.ticketOptionsBox}>
          <IconButton
            className={classes.addButtonStyled}
            onClick={() => setNewTicketModalOpen(true)}
          >
            <AddIcon />
          </IconButton>
          <Box className={classes.rightActions}>
            {user.profile === "admin" && (
              <Tooltip title={i18n.t("tickets.inbox.closedAll")}>
                <IconButton
                  onClick={() => setSnackbarOpen(true)}
                  size="small"
                  style={{
                    backgroundColor: theme.palette.type === 'dark' ? '#202c33' : '#f0f2f5',
                    color: theme.palette.type === 'dark' ? '#00a884' : '#008069',
                    width: 28,
                    height: 28,
                  }}
                >
                  <PlaylistAddCheckOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* SOLUCIÓN: Solo mostrar el botón showAll para admin */}
            {user?.profile?.toUpperCase() === 'ADMIN' && (
              <Tooltip title={getShowAllValue() ? i18n.t("tickets.buttons.hideAll") : i18n.t("tickets.buttons.showAll")}>
                <IconButton
                  onClick={() => setShowAllTickets((prev) => !prev)}
                  size="small"
                  style={{
                    backgroundColor: theme.palette.type === 'dark' ? '#202c33' : '#f0f2f5',
                    color: theme.palette.type === 'dark' ? '#aebac1' : '#54656f',
                    width: 28,
                    height: 28,
                  }}
                >
                  {getShowAllValue() ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Snackbar
            open={snackbarOpen}
            onClose={() => setSnackbarOpen(false)}
            message={i18n.t("tickets.inbox.closedAllTickets")}
            ContentProps={{ className: classes.snackbar }}
            action={
              <>
                <Button className={classes.yesButton} onClick={CloseAllTicket}>
                  {i18n.t("tickets.inbox.yes")}
                </Button>
                <Button className={classes.noButton} onClick={() => setSnackbarOpen(false)}>
                  {i18n.t("tickets.inbox.no")}
                </Button>
              </>
            }
          />
        </Paper>
      )}

      {/* Tab: Open */}
      <TabPanel value={tab} name='open' className={classes.ticketsWrapper}>
        <Tabs value={tabOpen} onChange={handleChangeTabOpen} variant='fullWidth' indicatorColor='primary' textColor='primary'>
          <Tab
            label={
              <Badge badgeContent={openCount} color='primary'>
                {i18n.t('ticketsList.assignedHeader')}
              </Badge>
            }
            value={'open'}
          />
          <Tab
            label={
              <Badge badgeContent={pendingCount} classes={{ badge: classes.pendingBadge }}>
                {i18n.t('ticketsList.pendingHeader')}
              </Badge>
            }
            value={'pending'}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status='open'
            showAll={getShowAllValue()}
            selectedQueueIds={selectedQueueIds}
            updateCount={setOpenCount}
            style={applyPanelStyle('open')}
          />
          <TicketsList
            status='pending'
            showAll={getShowAllValue()}
            selectedQueueIds={selectedQueueIds}
            updateCount={setPendingCount}
            style={applyPanelStyle('pending')}
          />
        </Paper>
      </TabPanel>

      {/* Tab: Group - SIN TABS INTERNOS */}
      {groupBox && (
        <TabPanel value={tab} name='group' className={classes.groupTicketsWrapper}>
          {/* ELIMINADO: Los Tabs internos para grupos */}
          <TicketsListGroup
            status={undefined} // No aplicar filtro de status para grupos
            showAll={true} // Siempre mostrar todos los grupos
            selectedQueueIds={selectedQueueIds}
            updateCount={(count) => {
              // Actualizar ambos contadores con el mismo valor para grupos
              setOpenCount(count);
              setPendingCount(count);
            }}
          />
        </TabPanel>
      )}

      {/* Tab: Closed */}
      {closedBox && (
        <TabPanel value={tab} name='closed' className={classes.ticketsWrapper}>
          <TicketsList
            status='closed'
            showAll={true}
            selectedQueueIds={selectedQueueIds}
          />
        </TabPanel>
      )}

      {/* Tab: Search */}
      <TabPanel value={tab} name='search' className={classes.ticketsWrapper}>
        {/* Campo de búsqueda por teléfono */}
        <Paper square elevation={0} style={{ padding: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Buscar por número de teléfono..."
            value={searchPhone}
            onChange={handleSearchPhoneChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* Filtros existentes */}
        <TagsFilter onFiltered={handleSelectedTags} />
        {user.profile === 'admin' && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}

        {/* Mostrar TicketsList solo si hay búsqueda o filtros activos */}
        {searchPhone || selectedTags.length > 0 || selectedUsers.length > 0 ? (
          <TicketsList
            searchParam={searchPhone}
            showAll={true}
            tags={selectedTags}
            users={selectedUsers}
            selectedQueueIds={selectedQueueIds}
          />
        ) : (
          <Paper style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            margin: '20px',
            flexDirection: 'column'
          }}>
            <SearchIcon style={{ fontSize: 48, color: '#ccc', marginBottom: '16px' }} />
            <p style={{ color: '#666', textAlign: 'center' }}>
              Ingresa un número de teléfono o selecciona filtros para buscar tickets
            </p>
          </Paper>
        )}
      </TabPanel>

    </Paper>
  );
};

export default TicketsManagerTabs;