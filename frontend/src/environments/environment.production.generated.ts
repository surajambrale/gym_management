import { environment as defaults } from './environment.production';

export const environment = {
  ...defaults,
  ...{},
  cloudinary: {
    ...defaults.cloudinary,
    ...{}
  }
};
