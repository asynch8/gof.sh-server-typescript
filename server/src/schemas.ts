import path from 'path';
// Custom-made library to convert TypeScript interfaces to JSON schema
import convert from 'ts-interface-to-json-schema';

export const userSchema = convert(
  'User',
  path.join(__dirname, './clients/users.ts')
);

/*export const contentSchema = convert(
  'Content',
  path.join(__dirname, './clients/content.ts')
);

export const apiKeySchema = convert(
  'ApiKey',
  path.join(__dirname, './clients/api_keys.ts')
);
*/

export const userWithoutIdSchema = JSON.parse(JSON.stringify(userSchema));
// Remove id from the schema
delete userWithoutIdSchema.properties.id;
// Clean up the required array(id will be at the start)
userWithoutIdSchema.required.shift();