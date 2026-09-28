# Saving from your phone

Save links to your <Abode /> from any app on your phone, straight from the share sheet, without copying and pasting.

## Android

1. Open <Abode /> in Chrome and sign in.
2. Tap the **⋮** menu, then **Add to Home screen** (or **Install app**) and confirm.
3. In any app, tap **Share** and pick <Abode /> from the list.

The link is saved and you land on your <Abode /> with a confirmation. <Abode /> only shows up in the share sheet once it's installed, and may be under **More** the first time.

## iPhone and iPad

iOS doesn't let web apps join the share sheet, so a Shortcut does the saving instead. Set it up once in the **Shortcuts** app:

1. Tap **+** to create a shortcut and name it **Save to abode**.
2. Tap the **ⓘ** button and turn on **Show in Share Sheet**.
3. Add the **URL Encode** action and set its input to **Shortcut Input**.
4. Add a **Text** action containing `{{appUrl}}/save?url=` followed by the **URL Encoded Text** variable.
5. Add the **Open URLs** action, which opens that text.

Now in Safari (or any app with a link), tap **Share**, then **Save to abode**. The link opens in Safari and is saved to your <Abode />.

## Troubleshooting

- **Not in the share sheet?** On Android, check <Abode /> is installed from Chrome. On iOS, scroll to the bottom of the share sheet and tap **Edit Actions** to add the shortcut.
- **Asked to sign in?** Sign in to <Abode /> in the same browser the share opens (Chrome on Android, Safari on iOS) and share again.
- **Nothing saved?** Only links can be shared in. To save a photo or screenshot, upload it from the **+** button instead.
