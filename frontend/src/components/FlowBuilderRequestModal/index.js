import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Box,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
  Paper,
  Chip,
  Grid
} from "@material-ui/core";
import { Add, Delete, Http } from "@material-ui/icons";

const FlowBuilderRequestModal = ({
  open,
  onClose,
  onSave,
  data,
  onUpdate,
  close,
  availableVariables = [] // ✅ NUEVO: Recibir variables disponibles del flow
}) => {
  const [formData, setFormData] = useState({
    url: "",
    method: "GET",
    headers: [{ key: "", value: "" }],
    body: "",
    saveResponseTo: "",
    useVariables: true
  });

  // ✅ MEJORADO: Usar variables reales del flow o mostrar mensaje si no hay
  const dynamicVariables = availableVariables.length > 0
    ? availableVariables
    : []; // Fallback por si no hay variables

  useEffect(() => {
    if (data && data.data && data.data.typebotIntegration) {
      setFormData(data.data.typebotIntegration);
    } else if (open === "create") {
      setFormData({
        url: "",
        method: "GET",
        headers: [{ key: "", value: "" }],
        body: "",
        saveResponseTo: "",
        useVariables: true
      });
    }
  }, [data, open]);

  const handleAddHeader = () => {
    setFormData(prev => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "" }]
    }));
  };

  const handleRemoveHeader = (index) => {
    setFormData(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index)
    }));
  };

  const handleHeaderChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      headers: prev.headers.map((header, i) =>
        i === index ? { ...header, [field]: value } : header
      )
    }));
  };

  const handleSave = () => {
    // Validaciones
    if (!formData.url.trim()) {
      alert("La URL es requerida");
      return;
    }

    if (formData.saveResponseTo && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.saveResponseTo)) {
      alert("El nombre de variable debe comenzar con letra y contener solo letras, números y guiones bajos");
      return;
    }

    // Validar JSON si se proporciona body
    if (formData.body && formData.method !== "GET") {
      try {
        if (formData.body.trim()) {
          JSON.parse(formData.body);
        }
      } catch (error) {
        alert("El cuerpo debe ser un JSON válido");
        return;
      }
    }

    // Filtrar headers vacíos
    const filteredHeaders = formData.headers.filter(header =>
      header.key.trim() && header.value.trim()
    );

    const requestData = {
      typebotIntegration: {
        ...formData,
        headers: filteredHeaders
      }
    };

    if (open === "edit" && data) {
      onUpdate({
        ...data,
        data: requestData
      });
    } else {
      onSave(requestData);
    }

    close();
  };

  const handleBodyTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      body: template
    }));
  };

  const insertVariable = (variable) => {
    const variableTemplate = `{{${variable}}}`;

    // Obtener el textarea del body
    const bodyTextarea = document.querySelector('textarea[name="body"]');

    if (bodyTextarea) {
      // Insertar en la posición del cursor
      const start = bodyTextarea.selectionStart;
      const end = bodyTextarea.selectionEnd;
      const currentBody = formData.body;

      const newBody = currentBody.substring(0, start) +
        variableTemplate +
        currentBody.substring(end);

      setFormData(prev => ({
        ...prev,
        body: newBody
      }));

      // Restaurar la posición del cursor después de la variable insertada
      setTimeout(() => {
        bodyTextarea.focus();
        bodyTextarea.setSelectionRange(start + variableTemplate.length, start + variableTemplate.length);
      }, 0);
    } else {
      // Fallback: agregar al final si no se encuentra el textarea
      setFormData(prev => ({
        ...prev,
        body: prev.body + variableTemplate
      }));
    }
  };

  // Función para manejar el cierre
  const handleClose = () => {
    if (close) {
      close();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={!!open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <Http style={{ marginRight: 8 }} />
          Configurar Request HTTP
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {/* URL */}
          <FormControl fullWidth required>
            <TextField
              label="URL del Endpoint"
              placeholder="https://api.ejemplo.com/data"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              variant="outlined"
              fullWidth
            />
            <FormHelperText>
              Usa variables como: {"{{nombre}}"}, {"{{email}}"}
            </FormHelperText>
          </FormControl>

          {/* Método HTTP */}
          <FormControl fullWidth variant="outlined">
            <InputLabel>Método HTTP</InputLabel>
            <Select
              value={formData.method}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                method: e.target.value
              }))}
              label="Método HTTP"
            >
              <MenuItem value="GET">GET</MenuItem>
              <MenuItem value="POST">POST</MenuItem>
              <MenuItem value="PUT">PUT</MenuItem>
              <MenuItem value="DELETE">DELETE</MenuItem>
              <MenuItem value="PATCH">PATCH</MenuItem>
            </Select>
          </FormControl>

          {/* Headers */}
          <FormControl fullWidth>
            <Typography variant="subtitle1" gutterBottom>
              Headers HTTP
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {(formData.headers || []).map((header, index) => (
                <Box key={index} display="flex" gap={1} alignItems="center">
                  <TextField
                    placeholder="Header (ej: Authorization)"
                    value={header.key || ""}
                    onChange={(e) => handleHeaderChange(index, "key", e.target.value)}
                    variant="outlined"
                    size="small"
                    fullWidth
                  />
                  <TextField
                    placeholder="Valor (ej: Bearer token)"
                    value={header.value || ""}
                    onChange={(e) => handleHeaderChange(index, "value", e.target.value)}
                    variant="outlined"
                    size="small"
                    fullWidth
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveHeader(index)}
                    disabled={(formData.headers || []).length === 1}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              ))}
              <Button
                startIcon={<Add />}
                onClick={handleAddHeader}
                variant="outlined"
                size="small"
                style={{ width: 'fit-content', marginBottom: "10px" }}
              >
                Agregar Header
              </Button>
            </Box>
          </FormControl>

          {/* Variables disponibles - MOSTRAR SIEMPRE */}
          <FormControl fullWidth>
            <Paper variant="outlined" style={{ padding: 8, marginBottom: 8 }}>
              <Typography variant="body2" gutterBottom>
                {availableVariables.length > 0
                  ? `Variables disponibles (${availableVariables.length}):`
                  : "⚠️ No hay variables disponibles en el flujo"}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {dynamicVariables.map(variable => (
                  <Chip
                    key={variable}
                    label={variable}
                    size="small"
                    onClick={() => insertVariable(variable, "url")} // ✅ Insertar en URL por defecto
                    variant="outlined"
                    color={availableVariables.length > 0 ? "primary" : "default"}
                  />
                ))}
              </Box>
              {availableVariables.length === 0 && (
                <Typography variant="caption" color="textSecondary">
                  Agrega nodos "question" al flujo para crear variables
                </Typography>
              )}
            </Paper>
          </FormControl>

          {/* Body (solo para POST, PUT, PATCH) */}
          {["POST", "PUT", "PATCH"].includes(formData.method) && (
            <FormControl fullWidth>
              <Typography variant="subtitle1" gutterBottom>
                Cuerpo de la Petición (JSON)
              </Typography>

              <TextField
                name="body"
                placeholder='{"nombre": "{{nombre}}", "email": "{{email}}"}'
                value={formData.body}
                onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                multiline
                rows={6}
                variant="outlined"
                fullWidth
              />

              {/* Plantillas rápidas */}
              <Box display="flex" gap={1} mt={1} alignItems="center">
                <Typography variant="body2">Plantillas:</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBodyTemplate('{\n  "name": "{{nombre}}",\n  "email": "{{email}}"\n}')}
                >
                  Datos Personales
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBodyTemplate('{\n  "message": "{{mensaje}}",\n  "timestamp": "{{fecha}}"\n}')}
                >
                  Mensaje Simple
                </Button>
              </Box>
            </FormControl>
          )}

          {/* Guardar respuesta */}
          <FormControl fullWidth>
            <TextField
              label="Guardar Respuesta en Variable"
              placeholder="nombreVariable (opcional)"
              value={formData.saveResponseTo}
              onChange={(e) => setFormData(prev => ({ ...prev, saveResponseTo: e.target.value }))}
              variant="outlined"
              helperText="La respuesta de la API se guardará en esta variable para usarla después"
            />
          </FormControl>

          {/* Usar variables */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.useVariables}
                onChange={(e) => setFormData(prev => ({ ...prev, useVariables: e.target.checked }))}
              />
            }
            label="Usar variables del flujo"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          Guardar Configuración
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderRequestModal;