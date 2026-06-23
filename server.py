# server.py
import json

def load_config():
    with open('config.json', 'r') as f:
        return json.load(f)

def save_config(config):
    with open('config.json', 'w') as f:
        json.dump(config, f, indent=2)

def get_export_data(state):
    export_rows = []
    for lamp in state['lamps']:
        top_y = lamp['anchorY'] == 'top' and lamp['edgeDistanceY'] or state['room']['heightMeters'] - lamp['edgeDistanceY'] - lamp['heightMeters']
        bottom_y = top_y + lamp['heightMeters']
        export_rows.append({
            'id': lamp['id'],
            'anchorY': lamp['anchorY'],
            'centerX': round(lamp['centerX'], 2),
            'edgeDistanceY': round(lamp['edgeDistanceY'], 2),
            'width_m': round(lamp['widthMeters'], 2),
            'height_m': round(lamp['heightMeters'], 2),
            'leftX_m': round(lamp['leftX'], 2),
            'rightX_m': round(lamp['rightX'], 2),
            'topY_m': round(top_y, 2),
            'bottomY_m': round(bottom_y, 2),
            'centerY_m': round((top_y + bottom_y) / 2, 2)
        })
    return export_rows

def get_cutting_details(state):
    cutting_details = []
    left_margin = max(0, state['room']['widthMeters'] - (state['grid']['alignmentX'] == 'left' and 0 or state['grid']['cols'] * state['grid']['cellMeters']))
    right_margin = max(0, state['grid']['alignmentX'] == 'right' and 0 or state['room']['widthMeters'] - (state['grid']['alignmentX'] == 'center' and state['grid']['cols'] * state['grid']['cellMeters'] / 2 or state['grid']['cols'] * state['grid']['cellMeters']))
    top_margin = max(0, state['grid']['alignmentY'] == 'top' and 0 or state['grid']['rows'] * state['grid']['cellMeters'])
    bottom_margin = max(0, state['grid']['alignmentY'] == 'bottom' and 0 or state['room']['heightMeters'] - (state['grid']['alignmentY'] == 'center' and state['grid']['rows'] * state['grid']['cellMeters'] / 2 or state['grid']['rows'] * state['grid']['cellMeters']))
    if left_margin > 0:
        cutting_details.append({
            'id': 'C1',
            'zone': 'left',
            'width_m': round(left_margin, 2),
            'height_m': round(state['room']['heightMeters'], 2),
            'quantity': math.ceil(left_margin / state['grid']['cellMeters'])
        })
    if right_margin > 0:
        cutting_details.append({
            'id': 'C2',
            'zone': 'right',
            'width_m': round(right_margin, 2),
            'height_m': round(state['room']['heightMeters'], 2),
            'quantity': math.ceil(right_margin / state['grid']['cellMeters'])
        })
    if top_margin > 0:
        cutting_details.append({
            'id': 'C3',
            'zone': 'top',
            'width_m': round(state['room']['widthMeters'], 2),
            'height_m': round(top_margin, 2),
            'quantity': math.ceil(top_margin / state['grid']['cellMeters'])
        })
    if bottom_margin > 0:
        cutting_details.append({
            'id': 'C4',
            'zone': 'bottom',
            'width_m': round(state['room']['widthMeters'], 2),
            'height_m': round(bottom_margin, 2),
            'quantity': math.ceil(bottom_margin / state['grid']['cellMeters'])
        })
    return cutting_details

def export_json(state):
    config = load_config()
    config['state'] = state
    save_config(config)
    return json.dumps(config, indent=2)

def export_csv(state):
    rows = get_export_data(state)
    csv_content = 'id,anchorY,centerX_m,edgeDistanceY_m,width_m,height_m,leftX_m,rightX_m,topY_m,bottomY_m,centerY_m\n'
    for row in rows:
        csv_content += f"{row['id']},{row['anchorY']},{row['centerX_m']},{row['edgeDistanceY_m']},{row['width_m']},{row['height_m']},{row['leftX_m']},{row['rightX_m']},{row['topY_m']},{row['bottomY_m']},{row['centerY_m']}\n"
    return csv_content

def export_svg(state):
    # SVG export logic remains the same
    pass

# Example usage
state = {
  'room': {
    'widthMeters': 10,
    'heightMeters': 8
  },
  'grid': {
    'rows': 5,
    'cols': 4,
    'cellMeters': 2,
    'alignmentX': 'center',
    'alignmentY': 'center'
  },
  'lamps': []
}

print(export_json(state))
print(export_csv(state))
