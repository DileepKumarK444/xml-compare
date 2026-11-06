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
import type { CompareOptions } from '../types';

const ITEMS: { key: keyof CompareOptions; label: string; tip: string }[] = [
  {
    key: 'ignore_whitespace',
    label: 'Ignore insignificant whitespace',
    tip: 'Ignores indentation, line breaks and repeated spaces that only affect formatting. Whitespace inside text content is still compared as a single space.',
  },
  {
    key: 'ignore_comments',
    label: 'Ignore XML comment differences',
    tip: 'Skips <!-- comments --> in both views so that changes to comments are not reported.',
  },
  {
    key: 'ignore_order',
    label: 'Ignore element ordering',
    tip: 'Element order is significant by default. Enable this only if sibling elements may appear in any order.',
  },
];

export default function OptionsPanel({
  value,
  onChange,
}: {
  value: CompareOptions;
  onChange: (o: CompareOptions) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Comparison Options
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0, md: 4 }}>
          {ITEMS.map((it) => (
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
