# Quick Start Guide - CleanSpace

## Installation & Setup

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Windows 10/11, macOS 10.13+, or Linux (Ubuntu 18.04+)

### Setup Steps

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Run in development mode
npm run electron:dev

# Or run production build
npm run electron:start
```

## Using the Application

### Dashboard Tab
- View overall storage statistics
- Select different drives to analyze
- See visual storage breakdown

### Analyze Tab
1. Click "Start Scan" to begin scanning selected drive
2. Watch real-time progress updates
3. Switch between views:
   - **Large Files** - Files >100MB
   - **Duplicates** - Duplicate files detected
   - **Old Files** - Not accessed in 6+ months
4. Click "Cancel Scan" to stop mid-scan

### Applications Tab
- View all installed applications
- Filter by usage (Never, Rarely, Frequently Used)
- Search for specific applications
- See storage usage per application
- Identify candidates for uninstallation

### Files Tab
- Browse all large files
- Search and filter by category
- View file details (size, date modified)
- Select files for cleanup review

### Clean Tab
1. Run a scan from the Analyze tab first
2. Review recommended cleanups:
   - **Duplicates** (Safe to remove)
   - **Old Downloads** (Review first)
   - **Cache Files** (Safe to remove)
   - **Temp Files** (Safe to remove)
   - **Rarely Used Apps** (Advanced)
3. Select items to clean
4. Click "Clean Now" to move to Recycle Bin
5. Files can be restored from Recycle Bin if needed

## Key Features

### 🔍 Smart Scanning
- Recursive directory traversal
- Real-time progress indication
- Configurable exclusion lists (system files protected)
- Fast scanning with progress tracking

### 📊 Intelligent Analysis
- Large file detection and ranking
- Duplicate file confirmation via hash verification
- Old file identification
- File categorization (Documents, Videos, Images, etc.)

### 🎯 Smart Recommendations
- Context-aware cleanup suggestions
- Safety level indicators (Safe, Caution, Advanced)
- Estimated space recovery
- File preview before deletion

### 🛡️ Safe Deletion
- Pre-deletion validation
- Move to Recycle Bin (fully recoverable)
- Protected system paths (cannot be deleted)
- Permission verification
- Confirmation dialogs

### 📱 Cross-Platform Support
- Windows: Registry-based app detection
- macOS: /Applications directory scanning
- Linux: Standard app paths

## Tips & Tricks

### Get the Most Out of Scanning
1. Start with Dashboard to see which drive needs attention
2. Run Analyze on drives with high usage
3. Sort results by size to find big winners
4. Review duplicates carefully (essential files might be duplicated)

### Safe Cleanup Strategy
1. Start with "Safe" recommendations (cache, temp files)
2. Review "Caution" recommendations before cleaning
3. "Advanced" recommendations should be reviewed carefully
4. Always keep a backup before major cleanup

### Finding Wasted Space
- Duplicates often consume significant space
- Large downloads folder cleanup can free up 10-50 GB
- Browser cache files add up quickly
- Temporary files are always safe to remove

### Before Big Cleanup
1. Backup important files
2. Note protected locations (Windows, Program Files, etc.)
3. Review "Advanced" recommendations carefully
4. Have Recycle Bin empty/ample space for moved files

## Troubleshooting

### Scan Won't Start
- Ensure you have read permissions for the drive
- Close file explorer windows to avoid locks
- Try scanning a subdirectory instead of root

### Applications Not Detected
- Windows: Requires administrator privileges for registry access
- Some portable apps may not be detected
- This is normal - focus on file cleanup instead

### Deletion Fails
- File may be in use by another program
- Check system file protections
- Some antivirus software may block operations
- Try moving to recycle bin instead of permanent deletion

### Performance Issues
- Avoid scanning network drives (very slow)
- Large directories (100k+ files) take time
- Disable background programs for faster scanning
- Close other applications for better performance

## Keyboard Shortcuts

- `Ctrl+1` - Dashboard
- `Ctrl+2` - Analyze
- `Ctrl+3` - Applications
- `Ctrl+4` - Files
- `Ctrl+5` - Clean

## Safety Features

✅ **Protected by Default:**
- System directories (Windows, Program Files, /System, /usr)
- Hidden system files (.git, AppData system folders)
- Read-only permissions checked
- File integrity validation

✅ **User Control:**
- All deletions are to Recycle Bin first
- Confirmation dialogs for destructive actions
- File preview before cleanup
- Easy undo from Recycle Bin

## Storage Units

- **1 KB** = 1,024 Bytes
- **1 MB** = 1,024 KB
- **1 GB** = 1,024 MB
- **1 TB** = 1,024 GB

Example: A 1 GB file = 1,073,741,824 bytes

## Contact & Support

For issues or feature requests, please refer to the IMPLEMENTATION_SUMMARY.md for detailed architecture information.

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Platform:** Windows, macOS, Linux
