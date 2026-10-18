import React, { useState } from "react";
import { IconButton, Tooltip } from "@material-ui/core";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import CheckIcon from "@material-ui/icons/Check";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

const CopyNumberButton = ({
  number,
  size = 14,
  tooltipPlacement = "top",
  showToast = true,
  style = {},
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!number) return;

    const textToCopy = String(number).trim();

    const doCopy = () => {
      setCopied(true);
      if (showToast) {
        toast.success(
          i18n.t("copyToClipboard.copied", "Número copiado al portapapeles")
        );
      }
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(doCopy)
        .catch(() => {
          fallbackCopy(textToCopy);
          doCopy();
        });
    } else {
      fallbackCopy(textToCopy);
      doCopy();
    }
  };

  const fallbackCopy = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Error al copiar número:", err);
    }
  };

  if (!number) return null;

  return (
    <Tooltip
      title={
        copied
          ? i18n.t("copyToClipboard.done", "¡Copiado!")
          : i18n.t("copyToClipboard.button", "Copiar número")
      }
      placement={tooltipPlacement}
      arrow
    >
      <IconButton
        size="small"
        onClick={handleCopy}
        className={className}
        aria-label="copiar número"
        style={{
          padding: 2,
          marginLeft: 4,
          color: copied ? "#25D366" : "inherit",
          opacity: copied ? 1 : 0.7,
          transition: "all 0.2s ease",
          verticalAlign: "middle",
          ...style,
        }}
      >
        {copied ? (
          <CheckIcon style={{ fontSize: size }} />
        ) : (
          <FileCopyOutlinedIcon style={{ fontSize: size }} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default CopyNumberButton;
