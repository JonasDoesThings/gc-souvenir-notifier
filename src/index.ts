import * as htmlparser2 from 'htmlparser2';
import * as domutils from 'domutils';

export interface Env {
    NOTIFIED_WEBHOOKS: string;
}

type Souvenir = {
    name: string;
    description?: string;
    startTimestamp: number;
    startDateStr: string;
    endTimestamp?: number;
    endDateStr?: string;
}

export default {
  async notifyAboutSouvenir(notifierTargetWebhookURL: string, souvenir: Souvenir) {
    const resp = (await fetch(notifierTargetWebhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'embeds': [
          {
            'title': souvenir.name,
            'color': 16728319,
            'description': souvenir.description ?? '',
            'footer': {
              'text': 'Data taken from https://thea-team.net/souvenirs',
            },
            'thumbnail': {
              'url': 'https://www.geocaching.com/images/about/logos/Signal_Poses_waving.png',
            },
            'fields': [
              {
                'name': 'Start Date',
                'value': souvenir.startDateStr,
              },
              {
                'name': 'End Date',
                'value': souvenir.endDateStr ?? '(failed to parse)',
              },
            ],
          },
        ],
      })}));

    return resp.status;
  },

  async findSouvenirsStartingToday(): Promise<Souvenir[]> {
    const todaysSouvenirs: Souvenir[] = [];
    const today = new Date();
    const todayStartTimestamp = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
    const todayEndTimestamp = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999);

    const dom = htmlparser2.parseDocument(await (await fetch('https://thea-team.net/souvenirs/date-based')).text());
    const table = domutils.getElementsByTagName('table', dom)[0];
    domutils.getElementsByTagName('tr', table).forEach(tableRow => {
      const cols = domutils.getElementsByTagName('td', tableRow);

      const [souvenirName, souvenirDescription, souvenirStartDate, souvenirEndDate] = cols.map(col => domutils.innerText(col));
      const souvenir = {
        name: souvenirName,
        description: souvenirDescription,
        startDateStr: souvenirStartDate,
        startTimestamp: Date.parse(souvenirStartDate + ' GMT'),
        endDateStr: souvenirEndDate,
        endTimestamp: Date.parse(souvenirEndDate + ' GMT'),
      };

      if (souvenir.startTimestamp >= todayStartTimestamp && souvenir.startTimestamp <= todayEndTimestamp) {
        todaysSouvenirs.push(souvenir);
      }
    });

    return todaysSouvenirs;
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const todaysSouvenirs = await this.findSouvenirsStartingToday();

    console.info(`${todaysSouvenirs.length} souvenirs found for today`);

    todaysSouvenirs.forEach(souvenir => {
      env.NOTIFIED_WEBHOOKS.split(' ').forEach(notifierTarget => {
        this.notifyAboutSouvenir(notifierTarget, souvenir);
      });
    });
  },
};
