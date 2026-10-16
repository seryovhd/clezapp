import React, { Fragment, useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import {
  Button,
  Paper,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
  Table,
  makeStyles,
  useTheme,
  Badge,
} from '@material-ui/core';
import * as XLSX from 'xlsx';
import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import {
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Tooltip,
  Typography,
  Box,
  Card,
  CardHeader,
  CardContent,
  Divider,
  Avatar
} from "@mui/material";
import { UsersFilter } from "../../components/UsersFilter";
import { TagsFilter } from "../../components/TagsFilter";
import { WhatsappsFilter } from "../../components/WhatsappsFilter";
import { StatusFilter } from "../../components/StatusFilter";
import useDashboard from "../../hooks/useDashboard";
import QueueSelectCustom from "../../components/QueueSelectCustom";
import moment from "moment";
import {
  Visibility as VisibilityIcon,
  SaveAlt as ExportIcon,
  FilterAlt as FilterIcon,
  Refresh as RefreshIcon,
  InsertChartOutlined as StatsIcon,
  WhatsApp as WhatsAppIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  ArrowForward as ArrowForwardIcon
} from "@mui/icons-material";
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TicketMessageModal from "../../components/TicketMessagesDialog";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray, capitalize } from "lodash";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark';

  return {
    root: {
      backgroundColor: isDark ? '#0b141a' : '#f8fafc',
      color: isDark ? '#e9edef' : '#111b21',
      height: '100vh',
      overflowX: 'hidden',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    },
    mainContent: {
      flex: 1,
      padding: theme.spacing(3),
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(4),
    },
    titleContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    titleIcon: {
      marginRight: theme.spacing(2),
      color: theme.palette.primary.main,
    },
    filterCard: {
      marginBottom: theme.spacing(4),
      borderRadius: 12,
      boxShadow: isDark ? '0 4px 20px 0 rgba(0,0,0,0.5)' : '0 4px 20px 0 rgba(0,0,0,0.05)',
      border: isDark ? '1px solid #222d34' : '1px solid rgba(0,0,0,0.05)',
      backgroundColor: isDark ? '#111b21' : '#ffffff',
    },
    filterCardHeader: {
      backgroundColor: isDark ? '#202c33' : theme.palette.primary.light,
      color: isDark ? '#e9edef' : theme.palette.primary.contrastText,
      borderRadius: '12px 12px 0 0',
      '& .MuiCardHeader-title': {
        color: isDark ? '#e9edef' : theme.palette.primary.contrastText,
        fontWeight: 600,
      },
    },
    tableCard: {
      borderRadius: 12,
      boxShadow: isDark ? '0 4px 20px 0 rgba(0,0,0,0.5)' : '0 4px 20px 0 rgba(0,0,0,0.05)',
      border: isDark ? '1px solid #222d34' : '1px solid rgba(0,0,0,0.05)',
      backgroundColor: isDark ? '#111b21' : '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'visible',
    },
    tableContainer: {
      height: 'calc(100vh - 450px)',
      minHeight: '300px',
      maxHeight: 'calc(100vh - 450px)',
      overflowY: 'scroll',
      overflowX: 'auto',
      paddingRight: '0px',
      marginRight: '0px',
      width: '100%',
      position: 'relative',
      '&::-webkit-scrollbar': {
        width: '14px !important',
        height: '14px !important',
        display: 'block !important',
        WebkitAppearance: 'none',
      },
      '&::-webkit-scrollbar-track': {
        backgroundColor: isDark ? '#111b21 !important' : '#d0d0d0 !important',
        borderRadius: '0px',
        margin: '0px',
        border: 'none',
        display: 'block !important',
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: isDark ? '#374248 !important' : '#666666 !important',
        borderRadius: '0px',
        border: isDark ? '2px solid #111b21' : '2px solid #d0d0d0',
        minHeight: '50px',
        display: 'block !important',
        '&:hover': {
          backgroundColor: isDark ? '#54656f !important' : '#333333 !important',
        },
      },
      '&::-webkit-scrollbar-thumb:active': {
        backgroundColor: isDark ? '#00a884 !important' : '#000000 !important',
      },
      '&::-webkit-scrollbar-corner': {
        backgroundColor: isDark ? '#111b21 !important' : '#d0d0d0 !important',
        display: 'block !important',
      },
      scrollbarWidth: 'thin',
      scrollbarColor: isDark ? '#374248 #111b21' : '#666666 #d0d0d0',
    },
    tableHead: {
      backgroundColor: isDark ? '#202c33' : theme.palette.grey[200],
      '& th': {
        backgroundColor: isDark ? '#202c33' : theme.palette.grey[200],
        color: isDark ? '#e9edef' : theme.palette.text.primary,
        fontWeight: 'bold',
        borderBottom: isDark ? '1px solid #222d34' : '1px solid #e0e0e0',
      },
    },
    tableCell: {
      padding: "8px 16px",
      borderBottom: isDark ? "1px solid #222d34" : "1px solid #e0e0e0",
      color: isDark ? '#e9edef' : theme.palette.text.primary,
      verticalAlign: "middle",
    },
    highlightRow: {
      "&:hover": {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      },
    },
    statusBadge: {
      padding: '6px 12px',
      borderRadius: 20,
      fontWeight: 'bold',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
    },
    openStatus: {
      backgroundColor: isDark ? 'rgba(33, 150, 243, 0.2)' : '#e3f2fd',
      color: isDark ? '#64b5f6' : theme.palette.primary.dark,
    },
    pendingStatus: {
      backgroundColor: isDark ? 'rgba(255, 152, 0, 0.2)' : '#fff8e1',
      color: isDark ? '#ffb74d' : '#ff8f00',
    },
    closedStatus: {
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9',
      color: isDark ? '#81c784' : '#2e7d32',
    },
    actionButton: {
      margin: theme.spacing(0.5),
      transition: 'all 0.2s',
      '&:hover': {
        transform: 'scale(1.1)',
      },
    },
    paginationContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing(2),
      backgroundColor: isDark ? '#111b21' : '#f5f7fa',
      borderRadius: '0 0 12px 12px',
      borderTop: isDark ? '1px solid #222d34' : '1px solid #e0e0e0',
      color: isDark ? '#e9edef' : theme.palette.text.primary,
    },
    statsCard: {
      marginBottom: theme.spacing(3),
    },
    statCard: {
      backgroundColor: isDark ? '#111b21' : '#ffffff',
      border: isDark ? '1px solid #222d34' : '1px solid rgba(0,0,0,0.05)',
      borderRadius: 12,
      boxShadow: isDark ? '0 4px 20px 0 rgba(0,0,0,0.5)' : '0 4px 20px 0 rgba(0,0,0,0.05)',
    },
    statsIcon: {
      fontSize: '3rem',
      color: theme.palette.primary.main,
    },
    filterButton: {
      marginLeft: theme.spacing(2),
      borderRadius: 8,
      textTransform: 'none',
      padding: '8px 16px',
    },
    exportButton: {
      backgroundColor: '#4caf50',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#388e3c',
      },
      borderRadius: 8,
      textTransform: 'none',
      padding: '8px 16px',
    },
    quickFilter: {
      marginRight: theme.spacing(1),
      borderRadius: 8,
      textTransform: 'none',
      padding: '6px 12px',
      color: isDark ? '#e9edef' : theme.palette.text.primary,
      borderColor: isDark ? '#222d34' : 'rgba(0,0,0,0.23)',
      backgroundColor: isDark ? '#111b21' : 'transparent',
      '&:hover': {
        backgroundColor: isDark ? '#202c33' : 'rgba(0,0,0,0.04)',
        borderColor: isDark ? '#00a884' : theme.palette.primary.main,
      },
    },
    queueBadge: {
      padding: '6px 12px',
      borderRadius: 20,
      fontWeight: 'bold',
      fontSize: '0.75rem',
      backgroundColor: isDark ? '#202c33' : theme.palette.grey[200],
      color: isDark ? '#e9edef' : theme.palette.text.primary,
    },
    truncatedText: {
      maxWidth: 200,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  };
});

const StatusBadge = ({ status }) => {
  const classes = useStyles();

  let badgeClass = '';
  switch (status) {
    case 'ABERTO':
      badgeClass = `${classes.statusBadge} ${classes.openStatus}`;
      status = 'ABIERTO';
      break;
    case 'PENDENTE':
      badgeClass = `${classes.statusBadge} ${classes.pendingStatus}`;
      status = 'PENDIENTE';
      break;
    case 'FECHADO':
      badgeClass = `${classes.statusBadge} ${classes.closedStatus}`;
      status = 'CERRADO';
      break;
    default:
      badgeClass = classes.statusBadge;
  }

  return (
    <Box display="flex" alignItems="center">
      {status === 'ABIERTO' && <CheckCircleIcon style={{ color: '#2196f3', marginRight: 4, fontSize: '1rem' }} />}
      {status === 'PENDIENTE' && <PendingIcon style={{ color: '#ff9800', marginRight: 4, fontSize: '1rem' }} />}
      {status === 'CERRADO' && <CancelIcon style={{ color: '#f44336', marginRight: 4, fontSize: '1rem' }} />}
      <span className={badgeClass}>{status}</span>
    </Box>
  );
};

const QueueBadge = ({ queueName, queueColor }) => {
  const classes = useStyles();
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';

  return (
    <span
      className={classes.queueBadge}
      style={{
        backgroundColor: queueColor || (isDark ? '#202c33' : '#e0e0e0'),
        color: queueColor ? '#fff' : (isDark ? '#e9edef' : '#111b21'),
      }}
    >
      {queueName || "SIN_FILA"}
    </span>
  );
};

const ChannelIcon = ({ channel }) => {
  switch (channel) {
    case 'whatsapp':
      return <WhatsAppIcon style={{ color: '#25D366' }} />;
    default:
      return <WhatsAppIcon style={{ color: '#25D366' }} />;
  }
};

const Relatorios = () => {
  const classes = useStyles();
  const history = useHistory();
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const { user } = useContext(AuthContext);
  const { getReport } = useDashboard();

  const initialContact = { id: "", name: "" };

  // State management
  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [currentContact, setCurrentContact] = useState(initialContact);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [queueIds, setQueueIds] = useState([]);
  const [ticketId, setTicketId] = useState('');
  const [userIds, setUserIds] = useState([]);
  const [dateFrom, setDateFrom] = useState(moment().subtract(7, 'days').format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [totalTickets, setTotalTickets] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [contacts, setContacts] = useState([initialContact]);
  const [searchParam, setSearchParam] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    pending: 0,
    closed: 0
  });

  // Load contacts
  useEffect(() => {
    const { companyId } = user;
    try {
      (async () => {
        const { data: contactList } = await api.get('/contacts/list', { params: { companyId: companyId } });
        let customList = contactList.map((c) => ({ id: c.id, name: c.name }));
        if (isArray(customList)) {
          setContacts([{ id: "", name: "" }, ...customList]);
        }
      })()
    } catch (err) {
      toastError(err);
    }
  }, [user]);

  // Set user filter for non-admin users
  useEffect(() => {
    if (user?.profile === 'user') {
      setUserIds([user.id]);
    }
  }, [user]);

  // Export to Excel function
  const exportToExcel = async () => {
    setLoading(true);
    try {
      const filterParams = {
        searchParam,
        contactId: currentContact?.id,
        whatsappId: JSON.stringify(selectedWhatsapp),
        users: JSON.stringify(userIds),
        queueIds: JSON.stringify(queueIds),
        status: JSON.stringify(selectedStatus),
        dateFrom,
        dateTo,
        page: 1,
        pageSize: 9999999,
      };

      if (ticketId) {
        filterParams.ticketId = ticketId;
      }

      const data = await getReport(filterParams);

      const ws = XLSX.utils.json_to_sheet(data.tickets);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RelatorioDeAtendimentos');
      XLSX.writeFile(wb, `reportes-atención-${moment().format('YYYY-MM-DD')}.xlsx`);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  // Función principal para aplicar filtros
  const handleFilter = async (page = 1) => {
    setLoading(true);

    try {
      const filterParams = {
        searchParam,
        contactId: currentContact?.id,
        whatsappId: JSON.stringify(selectedWhatsapp),
        users: JSON.stringify(userIds),
        queueIds: JSON.stringify(queueIds),
        status: JSON.stringify(selectedStatus),
        dateFrom,
        dateTo,
        page: page,
        pageSize: pageSize,
      };

      if (ticketId) {
        filterParams.ticketId = ticketId;
      }

      const data = await getReport(filterParams);

      setTotalTickets(data.totalTickets.total || 0); // Aseguramos que siempre haya número
      setHasMore(data.tickets.length === pageSize);
      setTickets(data.tickets);
      setPageNumber(page);

      // Aseguramos que todos los valores vengan con número, no undefined
      setStats({
        total: data.totalTickets.total ?? 0,
        open: data.totalTickets.open ?? 0,
        pending: data.totalTickets.pending ?? 0,
        closed: data.totalTickets.closed ?? 0,
      });

    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  // Quick filter functions
  const applyQuickFilter = (days) => {
    setDateFrom(moment().subtract(days, 'days').format("YYYY-MM-DD"));
    setDateTo(moment().format("YYYY-MM-DD"));
    handleFilter(1);
  };

  // User filter handler
  const handleSelectedUsers = (selecteds) => {
    const userVerify = selecteds.every((t) => t.id === user.id);

    try {
      if (user.profile === 'admin' || user.profile === 'supervisor') {
        const users = selecteds.map((t) => t.id);
        setUserIds(users);
      } else if (!userVerify) {
        toastError('No tienes permiso para filtrar tickets de otros usuarios');
        setUserIds([]);
      } else if (userVerify && user.profile === 'user') {
        setUserIds([user.id]);
      }
    } catch (error) {
      toastError(error);
    }
  };

  // Other filter handlers
  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);
    setSelectedWhatsapp(whatsapp);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);
    setSelectedStatus(statusFilter);
  };

  // Reset filters
  const resetFilters = () => {
    setCurrentContact(initialContact);
    setSelectedWhatsapp([]);
    setSelectedStatus([]);
    setQueueIds([]);
    setTicketId('');
    setUserIds(user?.profile === 'user' ? [user.id] : []);
    setDateFrom(moment().subtract(7, 'days').format("YYYY-MM-DD"));
    setDateTo(moment().format("YYYY-MM-DD"));
    setSearchParam("");
    handleFilter(1);
  };

  return (
    <div className={classes.root}>
      <div className={classes.mainContent}>
        <div className={classes.header}>
          <div className={classes.titleContainer}>
            <StatsIcon className={classes.titleIcon} fontSize="large" />
            <Typography variant="h4" component="h1" color="textPrimary">
              Reportes de Atención
            </Typography>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <Grid container spacing={3} className={classes.statsCard}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statCard}>
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Total de Tickets
                    </Typography>
                    <Typography variant="h4" style={{ color: isDark ? '#e9edef' : undefined }}>
                      {stats.total ?? 0}
                    </Typography>
                  </div>
                  <Avatar style={{ backgroundColor: '#2196f3', color: '#fff' }}>
                    <StatsIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statCard}>
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Abiertos
                    </Typography>
                    <Typography variant="h4" style={{ color: '#2196f3' }}>
                      {stats.open ?? 0}
                    </Typography>
                  </div>
                  <Avatar style={{ backgroundColor: isDark ? 'rgba(33, 150, 243, 0.2)' : '#e3f2fd', color: '#2196f3' }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statCard}>
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Pendientes
                    </Typography>
                    <Typography variant="h4" style={{ color: '#ff9800' }}>
                      {stats.pending ?? 0}
                    </Typography>
                  </div>
                  <Avatar style={{ backgroundColor: isDark ? 'rgba(255, 152, 0, 0.2)' : '#fff8e1', color: '#ff9800' }}>
                    <PendingIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.statCard}>
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom variant="h6">
                      Cerrados
                    </Typography>
                    <Typography variant="h4" style={{ color: '#4caf50' }}>
                      {stats.closed ?? 0}
                    </Typography>
                  </div>
                  <Avatar style={{ backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9', color: '#4caf50' }}>
                    <CancelIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Filters */}
        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          {/* Bloque de Filtros Rápidos */}
          <Box display="flex" alignItems="center">
            <Typography variant="subtitle1" style={{ marginRight: 16, color: isDark ? '#e9edef' : undefined }}>
              Período rápido:
            </Typography>

            <Button
              variant="outlined"
              onClick={() => applyQuickFilter(1)}
              className={classes.quickFilter}
            >
              Hoy
            </Button>
            <Button
              variant="outlined"
              onClick={() => applyQuickFilter(7)}
              className={classes.quickFilter}
            >
              7 Días
            </Button>
            <Button
              variant="outlined"
              onClick={() => applyQuickFilter(30)}
              className={classes.quickFilter}
            >
              30 Días
            </Button>
            <Button
              variant="outlined"
              onClick={resetFilters}
              className={classes.quickFilter}
              startIcon={<RefreshIcon />}
            >
              Limpiar filtros
            </Button>
          </Box>

          {/* Bloque de Aplicar Filtro y Exportar */}
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<FilterIcon />}
              onClick={() => handleFilter(1)}
              className={classes.filterButton}
            >
              Aplicar Filtros
            </Button>
            <Button
              variant="contained"
              startIcon={<ExportIcon />}
              onClick={exportToExcel}
              className={classes.exportButton}
              disabled={loading}
            >
              Exportar Excel
            </Button>
          </Box>
        </Box>

        {/* Filter Card */}
        <Card className={classes.filterCard}>
          <CardHeader
            title="Filtros Avanzados"
            className={classes.filterCardHeader}
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl variant="outlined" fullWidth>
                  <Autocomplete
                    fullWidth
                    value={currentContact}
                    options={contacts}
                    onChange={(e, contact) => {
                      setCurrentContact(contact ? contact : initialContact);
                    }}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => value?.id === option?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        label="Contacto"
                        placeholder="Seleccione un contacto"
                      />
                    )}
                  />
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <WhatsappsFilter onFiltered={handleSelectedWhatsapps} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatusFilter onFiltered={handleSelectedStatus} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <UsersFilter onFiltered={handleSelectedUsers} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <QueueSelectCustom
                  selectedQueueIds={queueIds}
                  onChange={values => setQueueIds(values)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Ticket ID"
                  type="number"
                  value={ticketId}
                  variant="outlined"
                  fullWidth
                  onChange={(e) => {
                    // Aceita apenas números
                    const value = e.target.value.replace(/\D/g, '');
                    setTicketId(value);
                  }}
                  inputProps={{
                    min: 1
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Fecha Inicial"
                  type="date"
                  value={dateFrom}
                  variant="outlined"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Fecha Final"
                  type="date"
                  value={dateTo}
                  variant="outlined"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card className={classes.tableCard} style={{ padding: 0, overflow: 'visible' }}>
          <div className={classes.tableContainer} style={{ overflowY: 'scroll', overflowX: 'auto' }}>
            <Table
              stickyHeader
              size="small"
              id="grid-attendants"
              style={{ borderCollapse: "collapse" }}
            >
              <TableHead className={classes.tableHead}>
                <TableRow>
                  <TableCell align="center">ID</TableCell>
                  <TableCell align="left">Canal</TableCell>
                  <TableCell align="left">Contacto</TableCell>
                  <TableCell align="left">Agente</TableCell>
                  <TableCell align="left">Cola</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="left">Último Mensaje</TableCell>
                  <TableCell align="center">Apertura</TableCell>
                  <TableCell align="center">Cierre</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <CircularProgress />
                      <Typography variant="body2" style={{ marginTop: 16 }}>
                        Cargando datos...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No se encontraron tickets con los filtros aplicados
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      className={classes.highlightRow}
                    >
                      <TableCell align="center" className={classes.tableCell}>
                        <Typography variant="body2" style={{ fontWeight: "bold" }}>
                          #{ticket.id}
                        </Typography>
                      </TableCell>

                      <TableCell align="left" className={classes.tableCell}>
                        <Box display="flex" alignItems="center">
                          <ChannelIcon channel={ticket.whatsappType} />
                          <Box ml={1}>{ticket.whatsappName}</Box>
                        </Box>
                      </TableCell>

                      <TableCell align="left" className={classes.tableCell}>
                        <Typography variant="body2" style={{ fontWeight: "500" }}>
                          {ticket.contactName}
                        </Typography>
                        {ticket.contactNumber && (
                          <Typography variant="caption" color="textSecondary">
                            {ticket.contactNumber}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="left" className={classes.tableCell}>
                        {ticket.userName || "No asignado"}
                      </TableCell>

                      <TableCell align="left" className={classes.tableCell}>
                        <QueueBadge
                          queueName={ticket.queueName}
                          queueColor={ticket.queueColor}
                        />
                      </TableCell>

                      <TableCell align="center" className={classes.tableCell}>
                        <StatusBadge status={ticket.status} />
                      </TableCell>

                      <TableCell align="left" className={classes.tableCell}>
                        <Typography
                          variant="body2"
                          noWrap
                          className={classes.truncatedText}
                          title={ticket.lastMessage}
                        >
                          {ticket.lastMessage || "-"}
                        </Typography>
                      </TableCell>

                      <TableCell align="center" className={classes.tableCell}>
                        <Typography variant="body2">
                          {moment(ticket.createdAt, "DD/MM/YYYY HH:mm").format("DD/MM/YY HH:mm")}
                        </Typography>
                      </TableCell>

                      <TableCell align="center" className={classes.tableCell}>
                        <Typography variant="body2">
                          {ticket.closedAt
                            ? moment(ticket.closedAt, "DD/MM/YYYY HH:mm").format("DD/MM/YY HH:mm")
                            : "-"}
                        </Typography>
                      </TableCell>

                      <TableCell align="center" className={classes.tableCell}>
                        <Tooltip title="Ver Ticket">
                          <IconButton
                            onClick={() => {
                              setSelectedTicketId(ticket.id);
                              setOpenTicketMessageDialog(true);
                            }}
                            className={classes.actionButton}
                            size="small"
                          >
                            <ArrowForwardIcon color="primary" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className={classes.paginationContainer}>
            <Typography variant="body2" color="textSecondary">
              Mostrando {tickets.length} de {totalTickets} resultados
            </Typography>
            <Box display="flex" alignItems="center">
              <FormControl variant="outlined" size="small" style={{ marginRight: 16, minWidth: 120 }}>
                <InputLabel>Ítems por página</InputLabel>
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    handleFilter(1);
                  }}
                  label="Ítems por página"
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
              <Pagination
                count={Math.ceil(totalTickets / pageSize)}
                page={pageNumber}
                onChange={(event, value) => handleFilter(value)}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
              />
            </Box>
          </div>
        </Card>
        {openTicketMessageDialog && (
          <TicketMessageModal
            open={openTicketMessageDialog}
            onClose={() => setOpenTicketMessageDialog(false)}
            ticketId={selectedTicketId}
          />
        )}
      </div>
    </div>
  );
};

export default Relatorios;