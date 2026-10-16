import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import {
  makeStyles,
  Paper,
  Typography,
  CircularProgress,
  Box,
} from '@material-ui/core';
import NewReleasesIcon from '@material-ui/icons/NewReleases';
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark';

  return {
    mainPaper: {
      flex: 1,
      padding: theme.spacing(3),
      overflowY: "auto",
      backgroundColor: isDark ? '#0b141a' : '#f8fafc',
      ...theme.scrollbarStyles,
    },
    container: {
      maxWidth: 800,
      margin: "0 auto",
      paddingBottom: theme.spacing(4),
    },
    headerWrapper: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(3),
    },
    headerIcon: {
      fontSize: '2.2rem',
      color: theme.palette.primary.main,
      marginRight: theme.spacing(1.5),
    },
    headerTitle: {
      fontWeight: 700,
      color: isDark ? '#e9edef' : '#111b21',
    },
    versionCard: {
      backgroundColor: isDark ? '#111b21' : '#ffffff',
      border: isDark ? '1px solid #222d34' : '1px solid rgba(0, 0, 0, 0.08)',
      borderRadius: 14,
      padding: theme.spacing(2.5),
      marginBottom: theme.spacing(2.5),
      boxShadow: isDark ? '0 4px 20px 0 rgba(0, 0, 0, 0.4)' : '0 4px 16px 0 rgba(0, 0, 0, 0.05)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: isDark ? '0 6px 24px 0 rgba(0, 0, 0, 0.6)' : '0 6px 20px 0 rgba(0, 0, 0, 0.1)',
      },
    },
    versionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: isDark ? '1px solid #222d34' : '1px solid #e9edef',
      paddingBottom: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
    },
    versionTitle: {
      color: theme.palette.primary.main,
      fontWeight: 700,
      fontSize: '1.15rem',
    },
    changesList: {
      paddingLeft: 0,
      margin: 0,
      listStyleType: 'none',
    },
    changeItem: {
      marginBottom: theme.spacing(1.2),
      lineHeight: 1.6,
      color: isDark ? '#e9edef' : '#111b21',
      fontSize: '0.925rem',
      display: 'flex',
      alignItems: 'flex-start',
      '& strong': {
        color: isDark ? '#00a884' : theme.palette.primary.dark,
        fontWeight: 600,
      },
    },
    bulletDot: {
      display: 'inline-block',
      width: 6,
      height: 6,
      borderRadius: '50%',
      backgroundColor: theme.palette.primary.main,
      marginTop: 8,
      marginRight: 10,
      flexShrink: 0,
    },
    loadingBox: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 250,
      color: isDark ? '#e9edef' : '#111b21',
    },
    errorBox: {
      padding: theme.spacing(2),
      backgroundColor: isDark ? 'rgba(244, 67, 54, 0.15)' : '#ffebee',
      border: isDark ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid #ffcdd2',
      color: isDark ? '#ef5350' : '#c62828',
      borderRadius: 8,
      textAlign: 'center',
      marginTop: theme.spacing(2),
    },
  };
});

const VersionLog = () => {
  const classes = useStyles();
  const [versionLog, setVersionLog] = useState([]);
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const [error, setError] = useState(null);

  // Control de acceso superadmin
  useEffect(() => {
    async function fetchData() {
      if (!user.super) {
        toast.error("¡Esta empresa no tiene permiso para acceder a esta página! Estamos redirigiéndolo.");
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchReadme = async () => {
      try {
        const response = await axios.get(
          'https://github.com/seryovhd/clezapp/blob/main/LogLauncher.md'
        );
        const decodedContent = decodeBase64(response.data.content);
        const parsedLog = parseVersionLog(decodedContent);
        setVersionLog(parsedLog);
        setLoading(false);
      } catch (err) {
        setError('Error al cargar el registro de versiones desde GitHub.');
        setLoading(false);
      }
    };

    fetchReadme();
  }, []);

  // Función para decodificar Base64 con soporte UTF-8
  const decodeBase64 = (str) => {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(str), (c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
  };

  const parseVersionLog = (content) => {
    const versions = content.split('## ').slice(1);
    return versions.map(versionText => {
      const [title, ...changes] = versionText.split('\n').filter(line => line.trim() !== '');
      return {
        version: title.trim(),
        changes: changes.map(change => change.trim().replace(/^[-*]\s*/, '').trim())
      };
    }).map(log => ({
      ...log,
      changes: log.changes.map(change => formatMarkdown(change))
    }));
  };

  const formatMarkdown = (text) => {
    const cleanText = text.replace(/•/g, '').trim();
    return cleanText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  };

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.headerWrapper}>
          <NewReleasesIcon className={classes.headerIcon} />
          <Title>{i18n.t("mainDrawer.listItems.LogLauncher", "Noticias y Versiones")}</Title>
        </div>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <div className={classes.container}>
          {loading && (
            <Box className={classes.loadingBox}>
              <CircularProgress color="primary" />
              <Typography variant="body2" style={{ marginTop: 16 }}>
                Cargando registro de versiones...
              </Typography>
            </Box>
          )}

          {error && !loading && (
            <Box className={classes.errorBox}>
              <Typography variant="body1">{error}</Typography>
            </Box>
          )}

          {!loading && !error && versionLog.map(({ version, changes }) => (
            <Paper key={version} className={classes.versionCard} variant="outlined">
              <div className={classes.versionHeader}>
                <Typography className={classes.versionTitle} variant="h6">
                  {version}
                </Typography>
              </div>
              <ul className={classes.changesList}>
                {changes.map((change, index) => (
                  <li key={index} className={classes.changeItem}>
                    <span className={classes.bulletDot} />
                    <span dangerouslySetInnerHTML={{ __html: change }} />
                  </li>
                ))}
              </ul>
            </Paper>
          ))}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default VersionLog;
