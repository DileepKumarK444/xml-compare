import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useFormat } from '../formats';
import type { CompareOptions } from '../types';

export default function OptionsPanel({
  value,
  onChange,
}: {
  value: CompareOptions;
  onChange: (o: CompareOptions) => void;
}) {
  const { options: items } = useFormat();
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Comparison Options
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0, md: 4 }}>
          {items.map((it) => (
            <Stack key={it.key} direction="row" sx={{ alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value[it.key]}
                    onChange={(e) => onChange({ ...value, [it.key]: e.target.checked })}
                  />
                }
                label={it.label}
              />
              <Tooltip title={it.tip} arrow placement="top">
                <InfoOutlinedIcon
                  fontSize="small"
                  color="action"
                  aria-label={`About: ${it.label}`}
                />
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
