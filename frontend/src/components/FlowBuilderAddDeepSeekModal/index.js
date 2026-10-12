import React, { useState, useEffect, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
} from "@material-ui/core";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";

const DeepSeekIcon = () => (
  <svg width="24" height="24" viewBox="0 0 60 60" fill="#4d6bfe">
    <path d="m57.61,13.47c-0.59,-0.29 -0.85,0.27 -1.2,0.55c-0.12,0.09 -0.22,0.21 -0.32,0.32c-0.87,0.93 -1.88,1.54 -3.21,1.46c-1.94,-0.11 -3.6,0.5 -5.07,1.99c-0.31,-1.83 -1.34,-2.93 -2.92,-3.63c-0.82,-0.36 -1.66,-0.73 -2.23,-1.52c-0.41,-0.56 -0.52,-1.19 -0.72,-1.81c-0.13,-0.37 -0.25,-0.76 -0.69,-0.82c-0.46,-0.07 -0.65,0.32 -0.83,0.65c-0.73,1.34 -1.02,2.81 -0.99,4.31c0.07,3.36 1.49,6.04 4.31,7.94c0.32,0.22 0.4,0.44 0.3,0.76c-0.19,0.65 -0.42,1.29 -0.62,1.95c-0.13,0.42 -0.32,0.51 -0.77,0.32c-1.55,-0.64 -2.89,-1.6 -4.07,-2.76c-2.01,-1.94 -3.82,-4.08 -6.08,-5.75c-0.53,-0.4 -1.06,-0.76 -1.61,-1.11c-2.31,-2.24 0.3,-4.08 0.9,-4.3c0.64,-0.23 0.22,-1.01 -1.82,-1c-2.04,0.01 -3.91,0.69 -6.29,1.6c-0.35,0.14 -0.72,0.24 -1.09,0.32c-2.16,-0.41 -4.41,-0.5 -6.75,-0.23c-4.42,0.49 -7.94,2.57 -10.53,6.14c-3.12,4.28 -3.85,9.14 -2.95,14.22c0.94,5.35 3.67,9.78 7.86,13.24c4.35,3.59 9.36,5.35 15.08,5.01c3.47,-0.2 7.34,-0.67 11.7,-4.36c1.09,0.55 2.25,0.77 4.16,0.93c1.48,0.14 2.9,-0.07 4,-0.3c1.72,-0.36 1.6,-1.96 0.98,-2.25c-5.05,-2.35 -3.94,-1.39 -4.95,-2.17c2.57,-3.03 6.43,-6.18 7.94,-16.4c0.12,-0.81 0.02,-1.32 0,-1.97c-0.01,-0.4 0.08,-0.56 0.54,-0.61c1.27,-0.14 2.49,-0.49 3.62,-1.11c3.27,-1.78 4.59,-4.72 4.9,-8.23c0.05,-0.54 -0.01,-1.1 -0.58,-1.38zm-28.49,31.65c-4.89,-3.84 -7.26,-5.11 -8.24,-5.05c-0.92,0.05 -0.76,1.1 -0.55,1.78c0.21,0.68 0.48,1.14 0.87,1.73c0.26,0.4 0.45,0.98 -0.27,1.42c-1.57,0.97 -4.31,-0.33 -4.44,-0.4c-3.19,-1.87 -5.85,-4.35 -7.73,-7.74c-1.82,-3.26 -2.87,-6.76 -3.04,-10.5c-0.05,-0.9 0.22,-1.22 1.12,-1.38c1.18,-0.22 2.39,-0.27 3.58,-0.09c4.99,0.73 9.24,2.96 12.8,6.49c2.03,2.02 3.57,4.42 5.16,6.77c1.68,2.5 3.5,4.88 5.8,6.83c0.82,0.68 1.47,1.2 2.09,1.58c-1.88,0.21 -5.01,0.26 -7.15,-1.44zm2.34,-15.08c0,-0.4 0.32,-0.72 0.73,-0.72c0.09,0 0.17,0.02 0.24,0.05c0.11,0.04 0.2,0.09 0.27,0.17c0.13,0.13 0.2,0.31 0.2,0.5c0,0.41 -0.32,0.72 -0.72,0.72s-0.72,-0.31 -0.72,-0.72zm7.29,3.74c-0.47,0.19 -0.94,0.36 -1.39,0.37c-0.69,0.04 -1.45,-0.24 -1.87,-0.59c-0.64,-0.54 -1.1,-0.84 -1.29,-1.78c-0.08,-0.4 -0.03,-1.02 0.04,-1.37c0.16,-0.77 -0.02,-1.26 -0.56,-1.71c-0.44,-0.36 -1,-0.46 -1.61,-0.46c-0.23,0 -0.44,-0.1 -0.6,-0.18c-0.25,-0.13 -0.46,-0.45 -0.26,-0.84c0.06,-0.13 0.37,-0.44 0.45,-0.49c0.83,-0.48 1.79,-0.32 2.68,0.03c0.82,0.34 1.45,0.96 2.34,1.84c0.92,1.05 1.09,1.34 1.61,2.14c0.41,0.62 0.79,1.25 1.04,1.98c0.16,0.46 -0.04,0.83 -0.58,1.06z"/>
  </svg>
);

const FlowBuilderAddDeepSeekModal = ({
  open,
  onSave,
  onClose,
  data,
  onUpdate,
}) => {
  const { user } = useContext(AuthContext);
  const [deepseekData, setDeepseekData] = useState({
    name: "",
    prompt: "",
    apiKey: "",
    model: "deepseek-chat",
    maxTokens: 1000,
    temperature: 0.7,
    maxMessages: 10,
    queueId: "",
    saveResponseTo: "", // ← NUEVO CAMPO
  });
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchQueues = async () => {
      try {
        setLoading(true);
        const response = await api.get("/queue", {
          params: { companyId: user?.companyId },
        });

        const queuesData = response?.data?.queues ||
          response?.data ||
          [];

        if (Array.isArray(queuesData)) {
          setQueues(queuesData);
        } else {
          console.warn("Datos de colas no son un array:", queuesData);
          setQueues([]);
        }
      } catch (err) {
        console.error("Error fetching queues:", err);
        setQueues([]);
      } finally {
        setLoading(false);
      }
    };

    if (user?.companyId && open) {
      fetchQueues();
    } else {
      setQueues([]);
    }
  }, [user, open]);

  useEffect(() => {
    if (data && open === "edit") {
      setDeepseekData({
        name: data.data?.typebotIntegration?.name || "",
        prompt: data.data?.typebotIntegration?.prompt || "",
        apiKey: data.data?.typebotIntegration?.apiKey || "",
        model: data.data?.typebotIntegration?.model || "deepseek-chat",
        maxTokens: data.data?.typebotIntegration?.maxTokens || 1000,
        temperature: data.data?.typebotIntegration?.temperature || 0.7,
        maxMessages: data.data?.typebotIntegration?.maxMessages || 10,
        queueId: data.data?.typebotIntegration?.queueId || "",
        saveResponseTo: data.data?.typebotIntegration?.saveResponseTo || "", // ← NUEVO CAMPO
      });
    } else if (open === "create") {
      setDeepseekData({
        name: "",
        prompt: "",
        apiKey: "",
        model: "deepseek-chat",
        maxTokens: 1000,
        temperature: 0.7,
        maxMessages: 10,
        queueId: "",
        saveResponseTo: "", // ← NUEVO CAMPO
      });
    }
  }, [data, open]);

  const handleSave = async () => {
    if (!deepseekData.name || !deepseekData.apiKey || !deepseekData.prompt) {
      toast.error("Por favor complete los campos requeridos");
      return;
    }

    const nodeData = {
      typebotIntegration: {
        ...deepseekData,
        type: "deepseek",
      },
    };

    if (open === "create") {
      onSave(nodeData);
    } else {
      onUpdate({
        ...data,
        data: nodeData,
      });
    }

    if (onClose && typeof onClose === "function") {
      onClose();
    }
  };

  const handleChange = (field, value) => {
    setDeepseekData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderQueueOptions = () => {
    if (!queues || !Array.isArray(queues) || queues.length === 0) {
      return <MenuItem value="">No hay colas disponibles</MenuItem>;
    }

    return queues.map((queue) => (
      <MenuItem key={queue.id} value={queue.id}>
        {queue.name || `Cola ${queue.id}`}
      </MenuItem>
    ));
  };

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DeepSeekIcon style={{ color: "#1E90FF" }} />
          <span>{open === "create" ? "Agregar DeepSeek" : "Editar DeepSeek"}</span>
        </div>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={2} style={{ marginTop: "8px" }}>
          <Grid item xs={12}>
            <TextField
              label="Nombre de la configuración *"
              fullWidth
              value={deepseekData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="API Key de DeepSeek *"
              fullWidth
              type="password"
              value={deepseekData.apiKey}
              onChange={(e) => handleChange("apiKey", e.target.value)}
              variant="outlined"
              helperText="Obten tu API Key en: https://platform.deepseek.com/"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Modelo</InputLabel>
              <Select
                value={deepseekData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                label="Modelo"
              >
                <MenuItem value="deepseek-chat">DeepSeek Chat</MenuItem>
                <MenuItem value="deepseek-coder">DeepSeek Coder</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>
                {loading ? "Cargando colas..." : "Transferir a cola"}
              </InputLabel>
              <Select
                value={deepseekData.queueId}
                onChange={(e) => handleChange("queueId", e.target.value)}
                label={loading ? "Cargando colas..." : "Transferir a cola"}
                disabled={loading}
              >
                <MenuItem value="">No transferir</MenuItem>
                {renderQueueOptions()}
              </Select>
              {loading && (
                <div style={{ position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)' }}>
                  <CircularProgress size={20} />
                </div>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Máximo de tokens"
              fullWidth
              type="number"
              value={deepseekData.maxTokens}
              onChange={(e) => handleChange("maxTokens", parseInt(e.target.value) || 1000)}
              variant="outlined"
              helperText="Máximo: 4096"
              inputProps={{ min: 1, max: 4096 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Temperatura"
              fullWidth
              type="number"
              value={deepseekData.temperature}
              onChange={(e) => handleChange("temperature", parseFloat(e.target.value) || 0.7)}
              variant="outlined"
              helperText="0 = más determinístico, 1 = más creativo"
              inputProps={{ min: 0, max: 1, step: 0.1 }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Máximo de mensajes en historial"
              fullWidth
              type="number"
              value={deepseekData.maxMessages}
              onChange={(e) => handleChange("maxMessages", parseInt(e.target.value) || 10)}
              variant="outlined"
              helperText="Número de mensajes anteriores a considerar"
              inputProps={{ min: 1, max: 50 }}
            />
          </Grid>

          {/* ✅ NUEVO CAMPO: Guardar respuesta en variable */}
          <Grid item xs={12}>
            <TextField
              label="Guardar respuesta en variable"
              fullWidth
              value={deepseekData.saveResponseTo}
              onChange={(e) => handleChange("saveResponseTo", e.target.value)}
              variant="outlined"
              helperText="Si se especifica, la respuesta se guardará en esta variable en lugar de mostrarse al usuario"
              placeholder="ej: sentimiento_analisis, intencion_cliente, etc."
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Prompt del sistema *"
              fullWidth
              multiline
              rows={4}
              value={deepseekData.prompt}
              onChange={(e) => handleChange("prompt", e.target.value)}
              variant="outlined"
              helperText="Instrucciones específicas para el comportamiento del AI"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancelar
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {open === "create" ? "Agregar" : "Actualizar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderAddDeepSeekModal;